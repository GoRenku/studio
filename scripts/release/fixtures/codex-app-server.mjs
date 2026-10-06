import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createInterface } from 'node:readline';

export function codexAppServerFixture(state) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => {
    child.exitCode = 0;
    child.stdout.end();
    child.stderr.end();
    child.emit('exit', 0);
  };
  child.stdin.on('finish', child.kill);
  state.requests ??= [];
  createInterface({ input: child.stdin }).on('line', (line) => {
    const request = JSON.parse(line);
    state.requests.push(request);
    if (!request.id || state.hang) return;
    if (state.invalidJson) { child.stdout.write('invalid\n'); return; }
    let result = {};
    if (request.method === 'skills/list') result = { data: [{ cwd: request.params.cwds[0], skills: state.skills, errors: state.errors || [] }] };
    if (request.method === 'skills/config/write' && !state.failMethod) {
      state.writes ??= [];
      state.writes.push(request.params.path);
      if (!state.ignoreWrite) state.skills.find((skill) => skill.path === request.params.path).enabled = false;
      result = { effectiveEnabled: state.rejectWrite ? true : false };
    }
    if (state.failMethod === request.method) {
      child.stdout.write(JSON.stringify({ id: request.id, error: { code: -32000, message: 'Write denied' } }) + '\n');
    } else {
      child.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
    }
  });
  return child;
}
