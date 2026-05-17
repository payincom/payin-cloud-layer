import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const sourceDirs = ['src', 'tests'];
const bannedPatterns = [
  /from ['"]\.\.\/payin(?:-open)?\//,
  /from ['"]\/data\/openclaw\/workspace\/payin(?:-open)?\//,
  /@payin\/(?:processor|manager|auth|notification)/,
];

describe('Cloud layer repository boundary', () => {
  it('does not directly import old PayIn Cloud or PayIn Open workspace packages', () => {
    const violations: string[] = [];
    for (const file of listFiles(sourceDirs, ['.ts', '.tsx'])) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of bannedPatterns) {
        if (pattern.test(text)) {
          violations.push(`${relative(repoRoot, file)} matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps package dependencies standalone and avoids file: workspace links', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    const violations: string[] = [];

    for (const section of dependencySections) {
      for (const [name, version] of Object.entries(pkg[section] ?? {})) {
        if (String(version).startsWith('file:')) violations.push(`${section}.${name}=${version}`);
        if (String(name).startsWith('@payin/') && section !== 'peerDependencies') violations.push(`${section}.${name}`);
      }
    }

    expect(violations).toEqual([]);
  });
});

function listFiles(dirs: string[], extensions: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) walk(join(repoRoot, dir), extensions, files);
  return files;
}

function walk(path: string, extensions: string[], files: string[]): void {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry), extensions, files);
    return;
  }
  if (extensions.some((extension) => path.endsWith(extension))) files.push(path);
}
