import { createInterface } from 'node:readline';

export async function openCodexAppServer(start, { timeoutMs = 30000 } = {}) {
  const child = start();
  const pending = new Map();
  let nextId = 0;
  let stopped;
  let stderr = '';
  const lines = createInterface({ input: child.stdout });

  function stop(error) {
    stopped ??= error;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(stopped);
    }
    pending.clear();
  }

  function receive(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      stop(new Error('INSTALL012 Codex app-server returned invalid JSON.'));
      child.kill();
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`INSTALL012 Codex ${request.method}: ${message.error.message}`));
    else request.resolve(message.result);
  }

  function request(method, params) {
    if (stopped) return Promise.reject(stopped);
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        stop(new Error(`INSTALL012 Codex ${method} timed out.`));
        child.kill();
      }, timeoutMs);
      pending.set(id, { method, resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }

  async function close() {
    stop(new Error('INSTALL012 Codex app-server closed.'));
    lines.close();
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve) => {
      const timer = setTimeout(() => { child.kill(); resolve(); }, 1000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.stdin.end();
    });
  }

  lines.on('line', receive);
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
  child.on('error', (error) => stop(new Error(`INSTALL012 Cannot start Codex app-server: ${error.message}`)));
  child.stdin.on('error', (error) => stop(new Error(`INSTALL012 Cannot write to Codex app-server: ${error.message}`)));
  child.on('exit', (code) => stop(new Error(`INSTALL012 Codex app-server exited (${code}): ${stderr.trim()}`)));
  try {
    await request('initialize', { clientInfo: { name: 'renku-installer', version: '1.0.0' } });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    return { request, close };
  } catch (error) {
    await close();
    throw error;
  }
}
