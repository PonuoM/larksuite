// Issues a new permanent (reusable) sign-in link for an existing, non-revoked principal — the way back in
// when an admin link is lost. Only the SHA-256 hash is stored; the full link is printed once to this terminal.
//
//   Local AppServ:  node scripts/issue-admin-link.mjs [--principal 1]
//   Production:     node scripts/issue-admin-link.mjs --remote root@187.77.127.28 [--principal 1]
//
// Local mode reads DB credentials from .env; remote mode runs SQL as root inside the workboard-db container over SSH.
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const execFile = promisify(execFileCallback);
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const remote = option('remote', '');
const principal = Number(option('principal', '1'));
if (!Number.isInteger(principal) || principal < 1) throw new Error('--principal must be a positive integer');

async function sql(statement) {
  if (remote) {
    return new Promise((resolve, reject) => {
      const child = spawn('ssh', ['-o', 'BatchMode=yes', remote, `docker exec -i workboard-db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N workboard'`], { windowsHide: true });
      let out = '', err = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { err += d; });
      child.on('close', (code) => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || 'remote sql failed')));
      child.stdin.end(statement);
    });
  }
  const env = await localEnv();
  const mysql = process.env.MYSQL_BIN || 'C:/AppServ/MySQL/bin/mysql.exe';
  return (await execFile(mysql, [`-u${env.DB_USER}`, `-h${env.DB_HOST || 'localhost'}`, '-N', env.DB_NAME, '-e', statement], { windowsHide: true, env: { ...process.env, MYSQL_PWD: env.DB_PASSWORD } })).stdout.trim();
}

async function localEnv() {
  const text = await readFile(new URL('../.env', import.meta.url), 'utf8');
  return Object.fromEntries(text.split(/\r?\n/).filter((l) => l && !l.startsWith(';')).map((l) => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim().replace(/^"|"$/g, '')]; }));
}

const found = await sql(`SELECT label FROM principals WHERE id=${principal} AND revoked_at IS NULL`);
if (!found) throw new Error(`principal ${principal} does not exist or is revoked`);
const token = crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(token).digest('hex');
await sql(`INSERT INTO invitations(principal_id,token_hash,reusable,expires_at) VALUES(${principal},'${hash}',1,NULL)`);

let base;
if (remote) base = option('origin', 'https://larksuite.prima49.com');
else { const env = await localEnv(); base = env.APP_ORIGIN + (env.APP_BASE || '').replace(/\/$/, ''); }
console.log(`Permanent link for "${found}" (principal ${principal}). Keep it private; close it from the access page when no longer needed:`);
console.log(`${base}/#invite=${token}`);
