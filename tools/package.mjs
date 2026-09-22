import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const deniedDirs = new Set([
  ".local",
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "test-results",
]);
const files = [];
function walk(relative = "") {
  for (const entry of fs.readdirSync(path.join(root, relative), {
    withFileTypes: true,
  })) {
    if (entry.isSymbolicLink()) continue;
    const item = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!deniedDirs.has(entry.name) && item !== "docs/sources") walk(item);
      continue;
    }
    if (
      entry.name === ".env" ||
      entry.name === 'recovery-key.bin' || /[.]srdbackup([.]json)?$/.test(entry.name) ||
      (entry.name.startsWith(".env.") && entry.name !== ".env.example") ||
      /\.(sqlite|log|tsbuildinfo)$/.test(entry.name) ||
      entry.name.startsWith(".phpunit")
    )
      continue;
    if (
      /\/(storage|bootstrap\/cache)\//.test(item) &&
      entry.name !== ".gitignore"
    )
      continue;
    if (
      [
        "tools/scaffold.mjs",
        "tools/migrations.mjs",
        "tools/test-config.mjs",
      ].includes(item)
    )
      continue;
    files.push(item);
  }
}
walk();
// Fail closed if an active local credential was accidentally copied into source.
const envFile = path.join(root, '.env');
const secrets = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => line.slice(line.indexOf('=') + 1).replace(/^"|"$/g, '')).filter(value => value.length >= 24) : [];
const fixtureFile = path.join(root, '.local/e2e-fixture.json');
if (fs.existsSync(fixtureFile)) secrets.push(JSON.parse(fs.readFileSync(fixtureFile, 'utf8')).password);
const browserFixtures = path.join(root, '.local/browser-fixtures');
if (fs.existsSync(browserFixtures)) {
  for (const entry of fs.readdirSync(browserFixtures, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const password = JSON.parse(fs.readFileSync(path.join(browserFixtures, entry.name), 'utf8')).password;
    if (typeof password === 'string' && password.length >= 24) secrets.push(password);
  }
}
for (const file of files) {
  const body = fs.readFileSync(path.join(root, file));
  if (secrets.some(secret => secret && body.includes(Buffer.from(secret)))) throw new Error(`Credencial local detectada en ${file}; paquete cancelado.`);
}
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.mkdirSync(path.join(root, ".local"), { recursive: true });
fs.writeFileSync(
  path.join(root, ".local/package-files.json"),
  JSON.stringify(files.sort()),
);
console.log(
  `${files.length} archivos fuente seleccionados; secretos y datos excluidos.`,
);
