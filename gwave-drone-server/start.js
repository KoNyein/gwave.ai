// start.js — run the REST api (:8788) and the ws game server (:8787) in one
// container. Either child dying kills the process so Docker's restart policy
// (and the deploy health gate) see the failure instead of a half-alive box.
import { spawn } from 'node:child_process';

for (const script of ['api.js', 'server.js']) {
  const child = spawn(process.execPath, [script], { stdio: 'inherit' });
  child.on('exit', (code) => {
    console.error(`[start] ${script} exited (${code}) — shutting down`);
    process.exit(code ?? 1);
  });
}
