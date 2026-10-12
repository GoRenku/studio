import type { NativeRequestControls } from '@gorenku/studio-codex/native-request-controls';
import type { JsonValue } from '@gorenku/studio-core/client';
import { PanelNativeControls } from '@/features/codex-panels/panel-native-controls';
import { ImageEditSectionHeading } from './image-edit-panel-frame';

/** One section per control group of the route, headed by the group label. */
export function ImageEditOutputSettings(input: { controls: NativeRequestControls; values: Record<string, JsonValue>; disabled: boolean; onChange: (key: string, value: JsonValue) => void }) {
  return input.controls.groups.map((group) => (
    <section key={group.label} className='flex flex-col gap-2.5'>
      <ImageEditSectionHeading>{group.label}</ImageEditSectionHeading>
      <PanelNativeControls controls={group.fields} values={input.values} disabled={input.disabled} onChange={input.onChange} />
    </section>
  ));
}
