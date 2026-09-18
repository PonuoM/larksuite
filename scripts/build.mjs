import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const env = { ...process.env };
delete env.npm_config_access_programs;

// Vite cannot empty `public/` because the PHP API lives there too. Remove only
// generated hashed assets so old bundles never accumulate or remain reachable.
const assetsDir = resolve(process.cwd(), 'public', 'assets');
mkdirSync(assetsDir, { recursive: true });
for (const entry of readdirSync(assetsDir)) {
  rmSync(resolve(assetsDir, entry), { recursive: true, force: true });
}

for (const args of [
  ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
