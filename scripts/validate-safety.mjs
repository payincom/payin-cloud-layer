#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

const excludedDirs = new Set(['.git', 'node_modules', 'dist']);
const textExtensions = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md', '.toml', '.yml', '.yaml',
  '.env', '.example', '.txt', '.sh', '.dockerfile', ''
]);

const allowedSecretPlaceholders = [
  'example', 'placeholder', 'replace-me', 'set-me', 'changeme', 'redacted', '<', '${', '$',
  'your_', 'test_', 'demo_', 'localhost', '127.0.0.1'
];

const secretKeyPattern = /(?:^|[\s"'`{,;])([A-Z0-9_]*(?:SECRET|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|PASSWORD|CREDENTIAL|SESSION|JWT)[A-Z0-9_-]*)\s*[:=]\s*(["'`]?)([^"'`\s,#}]+)\2/g;
const credentialMarkerPattern = /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bsk_live_[A-Za-z0-9]+\b|\bpk_live_[A-Za-z0-9]+\b|\bghp_[A-Za-z0-9_]{20,}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const forbiddenDirectories = [
  'apps/api',
  'packages/processor',
  'packages/manager',
  'packages/auth',
];

const backendRouteLogicPattern = /(?:from\s+['"][^'"]*(?:\.\.\/payin-cloud|\.\.\/payin-open\/apps\/api\/src|apps\/api\/src\/routes|packages\/(?:processor|manager|auth)|@payin\/(?:processor|manager|auth))|require\(['"][^'"]*(?:\.\.\/payin-cloud|\.\.\/payin-open\/apps\/api\/src|apps\/api\/src\/routes|packages\/(?:processor|manager|auth)|@payin\/(?:processor|manager|auth))|paymentRouter\b|merchantSettlement\b|apps\/api\/src\/routes\/payments)/i;

function toPosix(path) {
  return path.split(sep).join('/');
}

function fileExtension(path) {
  const file = path.split('/').pop() ?? path;
  if (file === 'Dockerfile' || file.startsWith('Dockerfile.')) return '.dockerfile';
  const index = file.lastIndexOf('.');
  return index === -1 ? '' : file.slice(index);
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(dir, entry.name);
    const rel = toPosix(relative(root, absolute));
    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name)) continue;
      files.push(...walk(absolute));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!textExtensions.has(fileExtension(rel))) continue;
    const size = statSync(absolute).size;
    if (size > 1_000_000) continue;
    files.push({ absolute, rel });
  }
  return files;
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return allowedSecretPlaceholders.some(marker => normalized.includes(marker));
}

function addFailure(check, file, detail) {
  failures.push({ check, file, detail });
}

function scanForbiddenCoreCopies(files) {
  for (const forbidden of forbiddenDirectories) {
    try {
      statSync(resolve(root, forbidden));
      addFailure('forbidden-core-copy', forbidden, 'forbidden backend/core directory exists in cloud layer');
    } catch {
      // absent is expected
    }
  }

  const implementationFiles = files.filter(({ rel }) => {
    if (!rel.startsWith('src/') && !rel.startsWith('apps/admin/src/') && !rel.startsWith('templates/')) return false;
    return !rel.endsWith('.md');
  });

  for (const { absolute, rel } of implementationFiles) {
    const content = readFileSync(absolute, 'utf8');
    if (backendRouteLogicPattern.test(content)) {
      addFailure('forbidden-route-logic-marker', rel, 'backend route/core import or implementation marker found in implementation file');
    }
  }
}

function scanSecrets(files) {
  const candidates = files.filter(({ rel }) => !rel.startsWith('.apcp/logs/') && rel !== 'scripts/validate-safety.mjs');
  for (const { absolute, rel } of candidates) {
    const content = readFileSync(absolute, 'utf8');
    credentialMarkerPattern.lastIndex = 0;
    if (credentialMarkerPattern.test(content)) {
      addFailure('credential-marker', rel, 'private key/token marker found; value intentionally redacted');
    }

    secretKeyPattern.lastIndex = 0;
    let match;
    while ((match = secretKeyPattern.exec(content)) !== null) {
      const key = match[1];
      const value = match[3];
      if (isPlaceholder(value)) continue;
      addFailure('likely-secret-literal', rel, `non-placeholder value assigned to ${key}; value intentionally redacted`);
    }
  }
}

function extractBacktickPaths(content) {
  const paths = [];
  const pathPattern = /`((?:docs|templates|\.apcp\/reports)\/[A-Za-z0-9._\/-]+)`/g;
  let match;
  while ((match = pathPattern.exec(content)) !== null) paths.push(match[1]);
  return paths;
}

function scanPathConsistency(files) {
  const docs = files.filter(({ rel }) => rel === 'README.md' || rel.startsWith('docs/') || rel.startsWith('.apcp/reports/') || rel === '.apcp/state.md');
  for (const { absolute, rel } of docs) {
    const content = readFileSync(absolute, 'utf8');
    for (const referencedPath of extractBacktickPaths(content)) {
      try {
        statSync(resolve(root, referencedPath));
      } catch {
        addFailure('docs-template-path-consistency', rel, `referenced path does not exist: ${referencedPath}`);
      }
    }
  }
}

const files = walk(root);
scanForbiddenCoreCopies(files);
scanSecrets(files);
scanPathConsistency(files);

const summary = {
  scannedFiles: files.length,
  failures: failures.length,
  warnings: warnings.length,
};

console.log(`safety: scanned ${summary.scannedFiles} local text files`);
if (warnings.length > 0) {
  console.log('safety: warnings');
  for (const warning of warnings) console.log(`- ${warning.check}: ${warning.file} (${warning.detail})`);
}
if (failures.length > 0) {
  console.error('safety: failed checks');
  for (const failure of failures) console.error(`- ${failure.check}: ${failure.file} (${failure.detail})`);
  process.exit(1);
}
console.log('safety: passed forbidden-copy, backend-import, secret-marker, and path-consistency scans');
