import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const run = randomUUID();
const directory = path.join(root, '.local/browser-fixtures');
fs.mkdirSync(directory, { recursive: true });
const fixture = {
  password: randomBytes(24).toString('hex'),
  orgA: randomUUID(), orgB: randomUUID(), termsA: randomUUID(), termsB: randomUUID(),
  codeA: `e2e-${run.slice(0, 18)}-a`, codeB: `e2e-${run.slice(0, 18)}-b`,
  users: Object.fromEntries(['admin', 'registrar', 'treasurer', 'auditor', 'viewer', 'superadmin'].map(role => [role, { id: randomUUID(), email: `${role}-${run}@srd-e2e.test` }])),
};
const file = path.join(directory, `${run}.json`);
fs.writeFileSync(file, JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
console.log(file);
