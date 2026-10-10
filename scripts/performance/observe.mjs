import { channel } from 'node:diagnostics_channel';
import { registerHooks } from 'node:module';
import { writeFileSync } from 'node:fs';

const destination = new URL(import.meta.url).searchParams.get('output');
if (!destination) throw new Error('The developer observer requires an output URL parameter.');
const modules = new Set();
const measurements = [];
const allowedPhases = {
  cli: new Set(['command-load', 'command']),
  core: new Set(['database-open', 'project-operation', 'studio-notification']),
  engines: new Set(['metadata', 'validation', 'upload', 'provider-wait', 'download']),
};
registerHooks({ load(url, context, nextLoad) {
  modules.add(url);
  return nextLoad(url, context);
}});
channel('renku.performance').subscribe((record) => {
  if (!allowedPhases[record.package]?.has(record.phase) ||
      !Number.isFinite(record.durationMs) || record.durationMs < 0 ||
      !['success', 'failure'].includes(record.outcome)) {
    throw new Error('Invalid performance measurement envelope.');
  }
  measurements.push({ package: record.package, phase: record.phase,
    durationMs: record.durationMs, outcome: record.outcome });
});
process.on('exit', () => writeFileSync(destination, JSON.stringify({
  note: 'Instrumented run; phases can overlap and must not be summed. Absent phases were not measured.',
  modules: [...modules], moduleCount: modules.size, measurements,
}, null, 2) + '\n'));
