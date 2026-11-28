/// <reference types="vite/client" />
// About_Panel text tests (task 42.2). Every expected value is a hand-written literal. The only value read from
// outside the source is apps/shot-rail/package.json (imported as raw text), for the version check.
//
// Source lines these tests should catch:
// - dropping or reordering a limit line in ABOUT_LIMIT_LINES (the count test and the key-phrase rows);
// - changing the sensor text so it no longer says "36 mm" (the sensor row);
// - a package version drifting from package.json without an About update (the package.json rows).
//
// Note on imports: '../../package.json?raw' is a Vite raw-text import, not a TypeScript module, so it keeps its
// own extension and does not end in .js. The relative TS import below ends in .js as the project rules require.

import { describe, expect, it } from 'vitest';
import pkgText from '../../package.json?raw';
import {
  ABOUT_LIMIT_LINES,
  ABOUT_SECTIONS,
  THIRD_PARTY_ROWS,
  aboutFullText,
  thirdPartyLine,
} from '../../src/view/about-panel-rules.js';
import type { ThirdPartyRow } from '../../src/view/about-panel-rules.js';

interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

const pkg = JSON.parse(pkgText) as PackageJson;

describe('About_Panel limit lines', () => {
  it('has exactly six limit lines', () => {
    expect(ABOUT_LIMIT_LINES.length).toBe(6);
  });

  it.each([
    [0, 'stand-in'],
    [1, 'world axes'],
    [2, 'one path per scene'],
    [3, '36 mm'],
    [4, 'rough planning'],
    [5, 'fixed rail'],
  ])('limit line %i contains "%s"', (index, phrase) => {
    expect(ABOUT_LIMIT_LINES[index]).toContain(phrase);
  });
});

describe('About_Panel third-party list', () => {
  // Compared fields: name, version and licence only (the `use` words are DRAFT text for the User to approve at 42.3, so they are not pinned here).
  it('lists the five packages in order with name, version and licence', () => {
    const fields = THIRD_PARTY_ROWS.map((r) => [r.name, r.version, r.licence]);
    expect(fields).toEqual([
      ['three', '0.187.0', 'MIT'],
      ['@types/three', '0.187.0', 'MIT'],
      ['Vite', '7.3.8', 'MIT'],
      ['Vitest', '3.2.7', 'MIT'],
      ['TypeScript', '5.9.3', 'Apache-2.0'],
    ]);
  });

  it.each([
    ['three', 'three'],
    ['@types/three', '@types/three'],
    ['Vite', 'vite'],
    ['Vitest', 'vitest'],
    ['TypeScript', 'typescript'],
  ])('version of %s equals the pinned version of "%s" in package.json', (displayName, packageKey) => {
    const row = THIRD_PARTY_ROWS.find((r) => r.name === displayName);
    if (row === undefined) throw new Error(`no THIRD_PARTY_ROWS row named ${displayName}`);
    const pinned = pkg.dependencies?.[packageKey] ?? pkg.devDependencies?.[packageKey];
    if (pinned === undefined) throw new Error(`package.json has no entry for ${packageKey}`);
    expect(pinned).toBe(row.version);
  });

  it('thirdPartyLine formats one row as name version, licence licence: use.', () => {
    const row: ThirdPartyRow = { name: 'three', version: '0.187.0', licence: 'MIT', use: 'draws the 3D views' };
    expect(thirdPartyLine(row)).toBe('three 0.187.0, MIT licence: draws the 3D views.');
  });
});

describe('About_Panel sections', () => {
  it('has the five sections in the shown order', () => {
    const shown = ABOUT_SECTIONS.map((s) => [s.id, s.heading]);
    expect(shown).toEqual([
      ['about-limits', 'What this app does not do'],
      ['about-labels', 'Labels'],
      ['about-sources', 'Facts and sources'],
      ['about-third-party', 'Third-party software'],
      ['about-keys', 'Keys'],
    ]);
  });

  it('has no section with an empty list or an empty line', () => {
    for (const section of ABOUT_SECTIONS) {
      if (section.lines.length === 0) throw new Error(`section ${section.id} has no lines`);
      for (let i = 0; i < section.lines.length; i++) {
        const line = section.lines[i];
        if (line === undefined || line.trim() === '') {
          throw new Error(`section ${section.id} line ${i} is empty or whitespace: ${JSON.stringify(line)}`);
        }
      }
    }
  });
});

describe('About_Panel full text', () => {
  it.each([
    ['About Shot Rail'],
    ['What this app does not do'],
    ['Labels'],
    ['Facts and sources'],
    ['Third-party software'],
    ['Keys'],
  ])('contains "%s"', (text) => {
    expect(aboutFullText()).toContain(text);
  });

  it('does not mention the dropped subjects "figure" or "abstract"', () => {
    const lower = aboutFullText().toLowerCase();
    expect(lower).not.toContain('figure');
    expect(lower).not.toContain('abstract');
  });
});
