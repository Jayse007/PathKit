import { describe, expect, it } from 'vitest';
import { CONTRAST_MIN, GRAPHIC_CONTRAST_MIN } from '../src/constants.js';
import { contrastRatio } from '../src/logic/contrast.js';
import { CHROME_PALETTE } from '../src/render/chrome-palette.js';
import { CLEAN_FILLS, LOOK_PALETTES } from '../src/render/looks.js';
import indexHtml from '../index.html?raw';

// Design Property 17. Requirements 17.3, 17.4, 22.1, 22.2.
// The page chrome is dark in both Looks. Only the Stage background and the Part materials change with the Look.

const P = CHROME_PALETTE;
const XRAY = LOOK_PALETTES.X_Ray_Skeleton;
const CLEAN = LOOK_PALETTES.Clean_Engineering;

interface Pair {
  readonly name: string;
  readonly a: string;
  readonly b: string;
  readonly min: number;
}

const chromeSurfaces: readonly (readonly [string, string])[] = [
  ['bg', P.bg],
  ['panel', P.panel],
  ['panelOpen', P.panelOpen],
  ['hover', P.hover],
];

function buildPairs(): Pair[] {
  const pairs: Pair[] = [];
  for (const [surfaceName, surface] of chromeSurfaces) {
    pairs.push({ name: `text on ${surfaceName}`, a: P.text, b: surface, min: CONTRAST_MIN });
    pairs.push({ name: `muted on ${surfaceName}`, a: P.muted, b: surface, min: CONTRAST_MIN });
    pairs.push({ name: `controlBorder on ${surfaceName}`, a: P.controlBorder, b: surface, min: CONTRAST_MIN });
  }
  for (const [surfaceName, surface] of chromeSurfaces.slice(0, 3)) {
    pairs.push({ name: `accent on ${surfaceName}`, a: P.accent, b: surface, min: CONTRAST_MIN });
    pairs.push({ name: `focusRing on ${surfaceName}`, a: P.focusRing, b: surface, min: CONTRAST_MIN });
  }
  // Stage, X_Ray_Skeleton: edges and the accent carry the shape. The translucent fill does not (see build notes).
  pairs.push({ name: 'X_Ray edge on Stage background', a: XRAY.edge as string, b: XRAY.background, min: CONTRAST_MIN });
  pairs.push({ name: 'X_Ray accent on Stage background', a: XRAY.accent, b: XRAY.background, min: CONTRAST_MIN });
  // Stage, Clean_Engineering: solid Part fills and the accent are graphical objects (3 to 1).
  CLEAN_FILLS.forEach((fill, i) => {
    pairs.push({ name: `Clean fill ${i} on Stage background`, a: fill, b: CLEAN.background, min: GRAPHIC_CONTRAST_MIN });
  });
  pairs.push({ name: 'Clean accent on Stage background', a: CLEAN.accent, b: CLEAN.background, min: GRAPHIC_CONTRAST_MIN });
  return pairs;
}

describe('palette contrast', () => {
  it('every text, interface and Stage pair of both Looks meets its minimum', () => {
    const pairs = buildPairs();
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      const ratio = contrastRatio(p.a, p.b);
      if (ratio < p.min) {
        throw new Error(`palette contrast: pair ${i} "${p.name}" (${p.a} on ${p.b}) is ${ratio.toFixed(3)}, below ${p.min}`);
      }
    }
    expect(pairs.length).toBe(24);
  });

  it('matches hand-computed ratios for four chosen pairs', () => {
    expect(Math.abs(contrastRatio(P.text, P.bg) - 15.5)).toBeLessThan(0.3);
    expect(Math.abs(contrastRatio(P.muted, P.panel) - 8.85)).toBeLessThan(0.2);
    expect(Math.abs(contrastRatio(XRAY.edge as string, XRAY.background) - 11.1)).toBeLessThan(0.3);
    expect(Math.abs(contrastRatio(CLEAN_FILLS[0], CLEAN.background) - 3.16)).toBeLessThan(0.1);
  });

  it('the chrome colours in index.html equal CHROME_PALETTE', () => {
    const cssVars: readonly (readonly [string, string])[] = [
      ['--bg', P.bg],
      ['--panel', P.panel],
      ['--panel-open', P.panelOpen],
      ['--hover', P.hover],
      ['--control-border', P.controlBorder],
      ['--text', P.text],
      ['--muted', P.muted],
      ['--accent', P.accent],
      ['--focus', P.focusRing],
    ];
    for (let i = 0; i < cssVars.length; i++) {
      const [name, expected] = cssVars[i];
      const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(indexHtml);
      if (m === null) throw new Error(`index.html check: variable ${name} (index ${i}) not found`);
      if (m[1].toLowerCase() !== expected) {
        throw new Error(`index.html check: ${name} (index ${i}) is ${m[1]}, palette says ${expected}`);
      }
    }
  });

  it('index.html has no hex colour outside the :root variables', () => {
    const rootEnd = indexHtml.indexOf('}');
    const rest = indexHtml.slice(rootEnd);
    const found = rest.match(/#[0-9a-fA-F]{3,6}\b/g);
    if (found !== null) throw new Error(`index.html check: hex colour outside :root: ${found.join(', ')}`);
  });
});
