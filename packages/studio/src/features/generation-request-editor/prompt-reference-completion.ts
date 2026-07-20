import {
  acceptCompletion,
  autocompletion,
  insertCompletionText,
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionSource,
} from '@codemirror/autocomplete';
import { Prec, type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import {
  filterGenerationPromptMentions,
  generationPromptMentionQuery,
  type GenerationPromptReferenceMention,
} from './prompt-mentions';

export function promptReferenceCompletion(
  mentions: GenerationPromptReferenceMention[],
): Extension {
  const source: CompletionSource = (context: CompletionContext) => {
    const value = context.state.doc.toString();
    const query = generationPromptMentionQuery(value, context.pos);
    if (!query) return null;
    const matchingMentions = filterGenerationPromptMentions(mentions, query.query);
    if (matchingMentions.length === 0) return null;
    return {
      from: query.start,
      to: query.end,
      filter: false,
      options: matchingMentions.map((mention) => completionForMention(mention)),
    };
  };

  return [
    autocompletion({
      activateOnTyping: true,
      closeOnBlur: true,
      defaultKeymap: true,
      icons: false,
      interactionDelay: 0,
      override: [source],
      selectOnOpen: true,
      tooltipClass: () => 'cm-prompt-reference-completion',
      optionClass: () => 'cm-prompt-reference-option',
      addToOptions: [{
        position: 40,
        render: (completion) => renderCompletionOption(completion, mentions),
      }],
    }),
    Prec.highest(keymap.of([{ key: 'Tab', run: acceptCompletion }])),
  ];
}

function completionForMention(
  mention: GenerationPromptReferenceMention,
): Completion {
  return {
    label: mention.value,
    displayLabel: mention.value,
    detail: mention.label,
    apply: (view, completion, from, to) => {
      view.dispatch({
        ...insertCompletionText(view.state, mention.value, from, to),
        annotations: pickedCompletion.of(completion),
        userEvent: 'input.complete',
      });
    },
  };
}

function renderCompletionOption(
  completion: Completion,
  mentions: GenerationPromptReferenceMention[],
): Node | null {
  const mention = mentions.find((candidate) => candidate.value === completion.label);
  if (!mention) return null;
  const option = document.createElement('span');
  option.className = 'cm-prompt-reference-option-content';

  const thumbnail = document.createElement('img');
  thumbnail.className = 'cm-prompt-reference-option-image';
  thumbnail.src = mention.previewImageUrl;
  thumbnail.alt = '';

  const copy = document.createElement('span');
  copy.className = 'cm-prompt-reference-option-copy';
  const title = document.createElement('span');
  title.className = 'cm-prompt-reference-option-title';
  title.textContent = mention.label;
  const token = document.createElement('span');
  token.className = 'cm-prompt-reference-option-token';
  token.textContent = mention.value;
  copy.append(title, token);
  option.append(thumbnail, copy);
  return option;
}
