#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const failures = [];
const excludedDirs = new Set(['node_modules', 'dist', '.git']);

function toPosix(path) {
  return path.split(sep).join('/');
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    const rel = toPosix(relative(root, absolute));
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) files.push(...walk(absolute));
      continue;
    }
    if (entry.isFile() && rel.startsWith('src/') && rel.endsWith('.ts')) files.push({ absolute, rel });
  }
  return files;
}

function fail(file, detail) {
  failures.push({ file, detail });
}

for (const { absolute, rel } of walk(join(root, 'src'))) {
  const content = readFileSync(absolute, 'utf8');
  if (/CreateAppOptions/.test(content)) {
    fail(rel, 'must not derive Cloud types from CreateAppOptions');
  }

  const importPattern = /import\s+([\s\S]*?)\s+from\s+['"](@payin\/app[^'"]*)['"]/g;
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const clause = match[1];
    const specifier = match[2];
    if (specifier === '@payin/app/runtime-contract') continue;
    if (specifier === '@payin/app/server' && /\bcreateApp\b/.test(clause) && !/\btype\b/.test(clause)) continue;
    fail(rel, `disallowed Open import: ${specifier}`);
  }

  const forbiddenPathPattern = /(?:\.\.\/payin-open|apps\/api\/src|@payin\/(?:processor|manager|auth))/;
  if (forbiddenPathPattern.test(content)) {
    fail(rel, 'must not import Open internals or payment core packages');
  }
}

try {
  statSync(join(root, 'src', 'adapters', 'open-app-export-needed.md'));
} catch {
  // Historical note is optional and not part of the runtime contract.
}

if (failures.length > 0) {
  console.error('open-contract-imports: failed');
  for (const failure of failures) console.error(`- ${failure.file}: ${failure.detail}`);
  process.exit(1);
}

console.log('open-contract-imports: passed allowed @payin/app contract imports');
