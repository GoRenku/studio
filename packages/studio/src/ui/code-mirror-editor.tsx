import {
  type ChangeSet,
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
  type Extension,
  type StateEffect,
} from '@codemirror/state';
import { EditorView, placeholder as placeholderExtension } from '@codemirror/view';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface CodeMirrorEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  extensions: readonly Extension[];
  readOnly?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
  spellCheck?: boolean;
}

interface CodeMirrorCompartments {
  attributes: Compartment;
  callerExtensions: Compartment;
  placeholder: Compartment;
  readOnly: Compartment;
}

interface ConfiguredEditorProps {
  ariaLabel: string;
  extensions: readonly Extension[];
  placeholder?: string;
  readOnly: boolean;
  spellCheck: boolean;
}

export function CodeMirrorEditor({
  value,
  onValueChange,
  extensions,
  readOnly = false,
  className,
  ariaLabel,
  placeholder,
  spellCheck = true,
}: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const serializedValueRef = useRef(value);
  const synchronizingRef = useRef(false);
  const onValueChangeRef = useRef(onValueChange);
  const [compartments] = useState(createCompartments);
  const configuredPropsRef = useRef<ConfiguredEditorProps>({
    ariaLabel,
    extensions,
    placeholder,
    readOnly,
    spellCheck,
  });
  const initialValueRef = useRef(value);

  useLayoutEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const configuredProps = configuredPropsRef.current;
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !synchronizingRef.current) {
        let serializedValue = serializedValueRef.current;
        for (const transaction of update.transactions) {
          if (transaction.docChanged) {
            serializedValue = applyDocumentChanges(serializedValue, transaction.changes);
          }
        }
        serializedValueRef.current = serializedValue;
        onValueChangeRef.current(serializedValue);
      }
    });
    const view = new EditorView({
      parent: host,
      state: createEditorState({
        value: initialValueRef.current,
        configuredProps,
        compartments,
        updateListener,
      }),
    });
    editorViewRef.current = view;
    return () => {
      editorViewRef.current = null;
      view.destroy();
    };
  }, [compartments]);

  useLayoutEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const nextConfiguredProps: ConfiguredEditorProps = {
      ariaLabel,
      extensions,
      placeholder,
      readOnly,
      spellCheck,
    };
    const currentConfiguredProps = configuredPropsRef.current;
    const effects: StateEffect<unknown>[] = [];
    if (currentConfiguredProps.extensions !== extensions) {
      effects.push(compartments.callerExtensions.reconfigure([...extensions]));
    }
    if (currentConfiguredProps.readOnly !== readOnly) {
      effects.push(compartments.readOnly.reconfigure(EditorState.readOnly.of(readOnly)));
    }
    if (currentConfiguredProps.placeholder !== placeholder) {
      effects.push(compartments.placeholder.reconfigure(
        placeholder ? placeholderExtension(placeholder) : [],
      ));
    }
    if (
      currentConfiguredProps.ariaLabel !== ariaLabel ||
      currentConfiguredProps.readOnly !== readOnly ||
      currentConfiguredProps.spellCheck !== spellCheck
    ) {
      effects.push(compartments.attributes.reconfigure(
        contentAttributes({ ariaLabel, readOnly, spellCheck }),
      ));
    }

    const currentValue = serializedValueRef.current;
    const normalizedValue = normalizeLineEndings(value);
    const currentDocument = view.state.doc.toString();
    if (currentValue !== value || effects.length > 0) {
      synchronizingRef.current = true;
      serializedValueRef.current = value;
      view.dispatch({
        changes: currentDocument === normalizedValue
          ? undefined
          : {
              from: 0,
              to: view.state.doc.length,
              insert: normalizedValue,
            },
        selection: currentValue === value
          ? undefined
          : selectionForReplacement(view.state.selection, normalizedLength(value)),
        effects,
        annotations: Transaction.addToHistory.of(false),
      });
      synchronizingRef.current = false;
    }
    configuredPropsRef.current = nextConfiguredProps;
  }, [ariaLabel, compartments, extensions, placeholder, readOnly, spellCheck, value]);

  return (
    <div
      ref={hostRef}
      className={cn('h-full min-h-0', className)}
      data-code-mirror-editor='true'
    />
  );
}

function createCompartments(): CodeMirrorCompartments {
  return {
    attributes: new Compartment(),
    callerExtensions: new Compartment(),
    placeholder: new Compartment(),
    readOnly: new Compartment(),
  };
}

function createEditorState(input: {
  value: string;
  configuredProps: ConfiguredEditorProps;
  compartments: CodeMirrorCompartments;
  selection?: EditorSelection;
  updateListener: Extension;
}): EditorState {
  return EditorState.create({
    doc: input.value,
    selection: input.selection,
    extensions: [
      input.compartments.readOnly.of(
        EditorState.readOnly.of(input.configuredProps.readOnly),
      ),
      EditorView.editable.of(true),
      input.compartments.attributes.of(contentAttributes(input.configuredProps)),
      input.compartments.placeholder.of(
        input.configuredProps.placeholder
          ? placeholderExtension(input.configuredProps.placeholder)
          : [],
      ),
      input.compartments.callerExtensions.of([
        ...input.configuredProps.extensions,
      ]),
      input.updateListener,
    ],
  });
}

function contentAttributes(input: {
  ariaLabel: string;
  readOnly: boolean;
  spellCheck: boolean;
}): Extension {
  return EditorView.contentAttributes.of({
    'aria-label': input.ariaLabel,
    'aria-readonly': String(input.readOnly),
    spellcheck: String(input.spellCheck),
  });
}

function normalizedLength(value: string): number {
  return normalizeLineEndings(value).length;
}

function selectionForReplacement(
  selection: EditorSelection,
  documentLength: number,
): EditorSelection {
  return EditorSelection.create(
    selection.ranges.map((range) => EditorSelection.range(
      Math.min(range.anchor, documentLength),
      Math.min(range.head, documentLength),
    )),
    selection.mainIndex,
  );
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\n');
}

function applyDocumentChanges(value: string, changes: ChangeSet): string {
  const offsets = serializedOffsets(value);
  if (offsets.length !== changes.length + 1) {
    throw new Error('CodeMirror serialized text is out of sync with its document.');
  }
  const insertedLineEnding = preferredInsertedLineEnding(value);
  let nextValue = '';
  let previousSerializedTo = 0;
  changes.iterChanges((from, to, _nextFrom, _nextTo, inserted) => {
    const serializedFrom = offsets[from]!;
    const serializedTo = offsets[to]!;
    nextValue += value.slice(previousSerializedTo, serializedFrom);
    nextValue += inserted.toString().replaceAll('\n', insertedLineEnding);
    previousSerializedTo = serializedTo;
  });
  return nextValue + value.slice(previousSerializedTo);
}

function serializedOffsets(value: string): number[] {
  const offsets = [0];
  let serializedOffset = 0;
  while (serializedOffset < value.length) {
    if (value[serializedOffset] === '\r' && value[serializedOffset + 1] === '\n') {
      serializedOffset += 2;
    } else {
      serializedOffset += 1;
    }
    offsets.push(serializedOffset);
  }
  return offsets;
}

function preferredInsertedLineEnding(value: string): '\n' | '\r\n' | '\r' {
  const counts = new Map<'\n' | '\r\n' | '\r', number>();
  for (const match of value.matchAll(/\r\n|\r|\n/g)) {
    const lineEnding = match[0] as '\n' | '\r\n' | '\r';
    counts.set(lineEnding, (counts.get(lineEnding) ?? 0) + 1);
  }
  let preferred: '\n' | '\r\n' | '\r' = '\n';
  let preferredCount = 0;
  for (const [lineEnding, count] of counts) {
    if (count > preferredCount) {
      preferred = lineEnding;
      preferredCount = count;
    }
  }
  return preferred;
}
