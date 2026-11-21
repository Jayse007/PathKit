import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../../', import.meta.url));
const srcDir = join(projectDir, 'src');

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) result.push(...listFiles(full));
    else result.push(full);
  }
  return result;
}

describe('project constraints', () => {
  const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));

  it('has test script "vitest run"', () => {
    expect(pkg.scripts.test).toBe('vitest run');
  });

  it('has no runtime dependencies', () => {
    expect(pkg.dependencies).toBeUndefined();
  });

  it('has exactly vitest and fast-check as dev dependencies', () => {
    expect(Object.keys(pkg.devDependencies).sort()).toEqual(['fast-check', 'vitest']);
  });

  it('never mentions "camera" in src (case-insensitive)', () => {
    for (const file of listFiles(srcDir)) {
      const text = readFileSync(file, 'utf8');
      expect(/camera/i.test(text), `"camera" found in ${file}`).toBe(false);
    }
  });

  it('has no hard-coded axis tokens or axis defaults outside scene.ts', () => {
    const tokenLiteral = /['"][+-][XYZ]['"]/;
    const axisDefault = /\b(forwardAxis|upAxis)\s*[:=]\s*['"]/;
    for (const file of listFiles(srcDir)) {
      if (basename(file) === 'scene.ts') continue;
      const text = readFileSync(file, 'utf8');
      expect(tokenLiteral.test(text), `axis token literal in ${file}`).toBe(false);
      expect(axisDefault.test(text), `axis default in ${file}`).toBe(false);
    }
  });
});
