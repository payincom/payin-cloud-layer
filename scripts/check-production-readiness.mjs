#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const auditMode = args.has('--audit');
const jsonMode = args.has('--json');

const sourceRoots = [
  'src',
  'apps/admin/src',
  'scripts',
  'docs',
  'package.json',
  'tsconfig.json',
  'apps/admin/package.json',
  'apps/admin/vite.config.ts',
].sort();

const allowedExtensions = new Set(['.css', '.js', '.json', '.md', '.mjs', '.ts', '.tsx']);
const skippedPathPattern = /(^|[/\\])(?:node_modules|dist|build|coverage|\.git)([/\\]|$)|(^|[/\\])\.env(?:\.|$)/i;

const files = collectFiles(sourceRoots);
const corpusByFile = new Map(files.map(file => [file, readFileSync(join(root, file), 'utf8')]));
const corpusText = [...corpusByFile].map(([file, text]) => `\n--- ${file} ---\n${text}`).join('\n');
const envNames = extractEnvNames(corpusText);

const checks = [
  {
    id: 'scope.railway-proof-non-goals',
    title: 'Railway proof scope excludes live billing and migration',
    severity: 'required',
    ready: has(/Railway production-capability proof|billing is a non-goal|no production data migration/i),
    evidence: evidence(['docs/production-readiness-r10.md', 'docs/deployment.md']),
    remediation: 'Document the proof-environment scope, non-goals, and human gates without treating billing as a blocker.',
  },
  {
    id: 'storage.hosted-postgres-capability',
    title: 'Hosted Postgres control-plane storage exists',
    severity: 'required',
    ready:
      hasIn('src/postgres-control-plane-storage.ts', /class PostgresControlPlaneStorage/) &&
      hasIn('src/postgres-control-plane-storage.ts', /runPostgresControlPlaneMigrations/) &&
      hasIn('scripts/control-plane-postgres.mjs', /DATABASE_URL/) &&
      hasIn('package.json', /control-plane:db:migrate/),
    evidence: evidence(['src/postgres-control-plane-storage.ts', 'scripts/control-plane-postgres.mjs', 'package.json']),
    remediation: 'Add a pg-backed storage implementation plus explicit DATABASE_URL migration/check commands.',
  },
  {
    id: 'auth.simulated-email-session',
    title: 'Simulated email login creates a server-side session boundary',
    severity: 'required',
    ready:
      has(/simulated-email-login|simulatedEmailLoginCloudLayerControlPlane/) &&
      has(/Set-Cookie|server-session-cookie/) &&
      has(/simulated-no-email-sent/),
    evidence: evidence(['src/local-control-plane.ts', 'apps/admin/src/lib/api.ts', 'apps/admin/src/pages/Login.tsx']),
    remediation: 'Add a no-email simulated login route that creates a persisted session and cookie, with browser storage only as a preview.',
  },
  {
    id: 'config.testnet-defaults',
    title: 'Easy testnet defaults are documented',
    severity: 'required',
    ready: has(/testnet|sepolia|proof network|RPC/i) && existsSync(join(root, 'docs/testnet-config.md')),
    evidence: evidence(['docs/testnet-config.md', 'docs/deployment.md']),
    remediation: 'Document low-risk testnet defaults and secret-handling expectations for Railway proof deployments.',
  },
  {
    id: 'ops.readiness-runbook',
    title: 'Readiness, operations, and rollback runbook exists',
    severity: 'required',
    ready: has(/readiness|liveness|rollback|incident|alert/i) && existsSync(join(root, 'docs/runbook.md')),
    evidence: evidence(['docs/runbook.md', 'src/cloud-runtime.ts', 'scripts/smoke-runtime.mjs']),
    remediation: 'Add a proof-environment runbook with checks, rollback, alerts, and incident handling.',
  },
  {
    id: 'safety.no-secrets-read',
    title: 'Gate avoids env files and secret values',
    severity: 'required',
    ready: files.every(file => !/(^|\/)\.env(?:\.|$)/i.test(file)) && /secretValuesRead:\s*false/.test(corpusText),
    evidence: evidence(['scripts/check-production-readiness.mjs', 'scripts/validate-safety.mjs']),
    remediation: 'Keep readiness checks source-only and never read .env files or secret values.',
  },
  {
    id: 'billing.non-goal',
    title: 'Billing integration is not required for this proof environment',
    severity: 'informational',
    ready: true,
    evidence: evidence(['docs/production-readiness-r10.md']),
    remediation: 'No action for R10; add billing only when the scope changes to live commercial production.',
  },
];

const blockers = checks.filter(check => check.severity === 'required' && !check.ready);
const result = {
  gate: 'R10 Railway production-capability proof readiness',
  mode: auditMode ? 'audit' : 'enforce',
  status: blockers.length === 0 ? 'pass' : auditMode ? 'audit-pass-with-blockers' : 'fail',
  deterministic: true,
  proofEnvironment: true,
  liveProductionApproval: false,
  safety: { envFilesRead: false, secretValuesRead: false, inspectedInputs: files },
  envVarNames: envNames,
  summary: { checks: checks.length, blockers: blockers.length },
  blockers: blockers.map(formatCheck),
  checks: checks.map(formatCheck),
};

if (jsonMode) console.log(JSON.stringify(result, null, 2));
else printMarkdown(result);
if (blockers.length > 0 && !auditMode) process.exitCode = 1;

function collectFiles(inputs) {
  const collected = [];
  for (const input of inputs) {
    const absolute = join(root, input);
    if (!existsSync(absolute)) continue;
    const stat = statSync(absolute);
    if (stat.isDirectory()) walk(input, collected);
    else if (isAllowedFile(input)) collected.push(normalizePath(input));
  }
  return [...new Set(collected)].sort((left, right) => left.localeCompare(right));
}
function walk(path, collected) {
  for (const entry of readdirSync(join(root, path)).sort((left, right) => left.localeCompare(right))) {
    const child = join(path, entry);
    if (skippedPathPattern.test(child)) continue;
    const stat = statSync(join(root, child));
    if (stat.isDirectory()) walk(child, collected);
    else if (isAllowedFile(child)) collected.push(normalizePath(child));
  }
}
function isAllowedFile(path) {
  const normalized = normalizePath(path);
  if (skippedPathPattern.test(normalized)) return false;
  if (/(^|\/)\.env(?:\.|$)/i.test(normalized)) return false;
  return allowedExtensions.has(extname(normalized));
}
function normalizePath(path) { return relative(root, join(root, path)).replaceAll('\\', '/'); }
function has(pattern) { return pattern.test(corpusText); }
function hasIn(file, pattern) { return pattern.test(corpusByFile.get(file) ?? ''); }
function evidence(paths) { return paths.filter(path => existsSync(join(root, path))).sort((left, right) => left.localeCompare(right)); }
function extractEnvNames(text) {
  const names = new Set();
  const patterns = [/\b(?:process\.)?env\.([A-Z][A-Z0-9_]*)\b/g, /\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)\b/g, /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) names.add(match[1]);
  return [...names].sort((left, right) => left.localeCompare(right));
}
function formatCheck(check) {
  return { id: check.id, title: check.title, severity: check.severity, status: check.ready ? 'ready' : 'blocker', evidence: check.evidence, remediation: check.remediation };
}
function printMarkdown(report) {
  console.log(`# ${report.gate}`);
  console.log('');
  console.log(`- Mode: ${report.mode}`);
  console.log(`- Status: ${report.status}`);
  console.log(`- Proof environment: ${report.proofEnvironment}`);
  console.log(`- Live production approval: ${report.liveProductionApproval}`);
  console.log(`- Env files read: ${report.safety.envFilesRead}`);
  console.log(`- Secret values read: ${report.safety.secretValuesRead}`);
  console.log(`- Checks: ${report.summary.checks}`);
  console.log(`- Blockers: ${report.summary.blockers}`);
  console.log('');
  console.log('## Environment Variable Names Inspected');
  console.log(report.envVarNames.length > 0 ? report.envVarNames.map(name => `- ${name}`).join('\n') : '- None');
  console.log('');
  console.log('## Blockers');
  if (report.blockers.length === 0) console.log('- None');
  else for (const blocker of report.blockers) {
    console.log(`- ${blocker.id}: ${blocker.title}`);
    console.log(`  - Evidence: ${blocker.evidence.length > 0 ? blocker.evidence.join(', ') : 'not found'}`);
    console.log(`  - Remediation: ${blocker.remediation}`);
  }
  console.log('');
  console.log('## Machine Summary');
  console.log('```json');
  console.log(JSON.stringify({ status: report.status, blockers: report.blockers.map(blocker => blocker.id) }, null, 2));
  console.log('```');
}
