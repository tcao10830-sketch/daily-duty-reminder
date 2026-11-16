import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const viteBin = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');

const server = spawn(process.execPath, ['--experimental-strip-types', '--watch', resolve(root, 'server/index.ts')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DEV: '1' },
});
const client = spawn(process.execPath, [viteBin], { cwd: root, stdio: 'inherit' });

function shutdown() {
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('exit', (code) => { if (code && code !== 0) shutdown(); });
client.on('exit', (code) => { if (code && code !== 0) shutdown(); });
