import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bake } from '../../src/bake.js';
import { SceneError } from '../../src/scene.js';
import type { AxisToken, Constraint, OrbitAroundConstraint, Scene, Target } from '../../src/scene.js';
import { bakedPosition, buildOrbitScene } from '../helpers/orbit-generators.js';
import type { OrbitCase } from '../helpers/orbit-generators.js';

// Hand-computed positions and dispatch evidence for orbitAround.
// Expected values are literals worked out from the Side_Vectors table of requirements.md:
//   +X: (+Y, +Z)  -X: (+Z, +Y)  +Y: (+Z, +X)  -Y: (+X, +Z)  +Z: (+X, +Y)  -Z: (+Y, +X)
// Position = centre + radius * (cos(angle) * side1 + sin(angle) * side2).
// Tolerance is 1e-12 and never Object.is, because -0 can appear.

const TOL = 1e-12;

function near(label: string, actual: readonly number[], expected: readonly number[], tol = TOL): void {
  for (let k = 0; k < 3; k++) {
    if (!(Math.abs(actual[k] - expected[k]) <= tol)) {
      throw new Error(`${label}: component ${k} is ${actual[k]}, expected ${expected[k]} (actual [${actual.join(', ')}], expected [${expected.join(', ')}])`);
    }
  }
}

function orbitCase(over: Partial<OrbitCase>): OrbitCase {
  return {
    fps: 30,
    frameCount: 2,
    axis: '+Y',
    radius: 5,
    speed: 0,
    startAngle: 0,
    centre: { kind: 'static', c: [0, 0, 0] },
    ...over,
  };
}

/** Bakes one case and returns the position at each frame. */
function positionsOf(c: OrbitCase): number[][] {
  const baked = bake(buildOrbitScene(c));
  const result: number[][] = [];
  for (let f = 0; f < c.frameCount; f++) result.push(bakedPosition(baked, 0, f, [0, 0, 0]));
  return result;
}

describe('orbitAround: the four brief examples (Requirements 2.8 to 2.11)', () => {
  it('+Y, radius 5: (0, 0, 5) at 0 degrees and (5, 0, 0) at 90 degrees', () => {
    const [p0, p1] = positionsOf(orbitCase({ axis: '+Y', radius: 5, speed: 90 * 30 }));
    near('+Y 0 degrees', p0, [0, 0, 5]);
    near('+Y 90 degrees', p1, [5, 0, 0]);
  });

  it('+X, radius 2, 90 degrees: (0, 0, 2)', () => {
    const [, p1] = positionsOf(orbitCase({ axis: '+X', radius: 2, speed: 90 * 30 }));
    near('+X 90 degrees', p1, [0, 0, 2]);
  });

  it('+Z, radius 3, 90 degrees: (0, 3, 0)', () => {
    const [, p1] = positionsOf(orbitCase({ axis: '+Z', radius: 3, speed: 90 * 30 }));
    near('+Z 90 degrees', p1, [0, 3, 0]);
  });
});

describe('orbitAround: every axis token at 0 and 90 degrees (Requirements 2.4, 2.12, 8.6)', () => {
  // Radius 2, centre at the origin. Frame 0 is at 0 degrees, frame 1 is at 90 degrees.
  const TABLE: [AxisToken, number[], number[]][] = [
    ['+X', [0, 2, 0], [0, 0, 2]],
    ['-X', [0, 0, 2], [0, 2, 0]],
    ['+Y', [0, 0, 2], [2, 0, 0]],
    ['-Y', [2, 0, 0], [0, 0, 2]],
    ['+Z', [2, 0, 0], [0, 2, 0]],
    ['-Z', [0, 2, 0], [2, 0, 0]],
  ];
  for (const [axis, at0, at90] of TABLE) {
    it(`${axis}: ${JSON.stringify(at0)} at 0 degrees and ${JSON.stringify(at90)} at 90 degrees`, () => {
      const [p0, p1] = positionsOf(orbitCase({ axis, radius: 2, speed: 90 * 30 }));
      near(`${axis} 0 degrees`, p0, at0);
      near(`${axis} 90 degrees`, p1, at90);
    });
  }

  it('startAngle 90 at frame 0 gives the same position as 90 degrees reached by speed', () => {
    const [p0] = positionsOf(orbitCase({ axis: '-Y', radius: 2, startAngle: 90 }));
    near('-Y startAngle 90', p0, [0, 0, 2]);
  });
});

describe('orbitAround: angle, centre, radius, direction and lap', () => {
  it('speed 90, fps 30: frame 30 is at 90 degrees (Requirement 2.1)', () => {
    const c = orbitCase({ axis: '+Y', radius: 5, speed: 90, fps: 30, frameCount: 31 });
    const positions = positionsOf(c);
    near('frame 0', positions[0], [0, 0, 5]);
    near('frame 30', positions[30], [5, 0, 0]);
  });

  it('a keyframed centre carries the offset with it (Requirements 2.5, 2.18)', () => {
    // Centre is (1,0,0) + frame * (1,2,0.5). +Y axis, radius 2, 90 degrees per frame.
    // Offsets: frame 0 (0,0,2), frame 1 (2,0,0), frame 2 (0,0,-2), frame 3 (-2,0,0).
    const c = orbitCase({
      axis: '+Y',
      radius: 2,
      speed: 90 * 30,
      frameCount: 4,
      centre: { kind: 'linear', c0: [1, 0, 0], step: [1, 2, 0.5] },
    });
    const p = positionsOf(c);
    near('frame 0', p[0], [1, 0, 2]);
    near('frame 1', p[1], [4, 2, 0.5]);
    near('frame 2', p[2], [3, 4, -1]);
    near('frame 3', p[3], [2, 6, 1.5]);
  });

  it('radius 0 puts the entity on the centre at every frame, first and last included (Requirement 2.6)', () => {
    const c = orbitCase({
      radius: 0,
      speed: 2700,
      startAngle: 37,
      frameCount: 6,
      centre: { kind: 'static', c: [1, 2, 3] },
    });
    const p = positionsOf(c);
    for (let f = 0; f < c.frameCount; f++) near(`frame ${f}`, p[f], [1, 2, 3]);
  });

  it('radius 0 on a moving centre follows the centre exactly', () => {
    const c = orbitCase({
      radius: 0,
      speed: 2700,
      frameCount: 4,
      centre: { kind: 'linear', c0: [1, 0, 0], step: [1, 2, 0.5] },
    });
    const p = positionsOf(c);
    near('frame 0', p[0], [1, 0, 0]);
    near('frame 3', p[3], [4, 6, 1.5]);
  });

  it('a negative speed turns the opposite way from the same positive speed (Requirement 2.7)', () => {
    // +Y axis: +90 degrees gives (5,0,0), -90 degrees gives (-5,0,0).
    const positive = positionsOf(orbitCase({ axis: '+Y', radius: 5, speed: 2700 }));
    const negative = positionsOf(orbitCase({ axis: '+Y', radius: 5, speed: -2700 }));
    near('positive speed, frame 1', positive[1], [5, 0, 0]);
    near('negative speed, frame 1', negative[1], [-5, 0, 0]);
  });

  it('a 360-degree lap returns to the start (Requirement 2.16)', () => {
    // speed 90 degrees per second at 30 fps: frame 120 is at 360 degrees.
    const c = orbitCase({ axis: '+Y', radius: 5, speed: 90, fps: 30, frameCount: 121 });
    const p = positionsOf(c);
    near('frame 0', p[0], [0, 0, 5]);
    near('frame 30', p[30], [5, 0, 0]);
    near('frame 60', p[60], [0, 0, -5]);
    near('frame 90', p[90], [-5, 0, 0]);
    near('frame 120', p[120], [0, 0, 5]);
  });

  it('a turn of exactly 360 degrees in one frame lands on the start', () => {
    const [p0, p1] = positionsOf(orbitCase({ axis: '-Z', radius: 5, speed: 360 * 30 }));
    near('frame 0', p0, [0, 5, 0]);
    near('frame 1', p1, [0, 5, 0]);
  });
});

describe('orbitAround: angle guard (Requirements 2.19, 8.26)', () => {
  it('speed 1e308, fps 30, frameCount 3 throws a SceneError naming frame 2', () => {
    const scene = buildOrbitScene(orbitCase({ speed: 1e308, fps: 30, frameCount: 3 }));
    expect(() => bake(scene)).toThrow(
      new SceneError('Entity "orbiter": orbitAround angle at frame 2 must be a finite number, got Infinity'),
    );
  });
});

describe('dispatch evidence: one test per constraint type (Requirements 5.1, 5.10, 8.16)', () => {
  /** A copy of the orbit scene with its constraints, targets and path start replaced. */
  function sceneWith(constraints: Constraint[], targets: Record<string, Target>, pathStart?: [number, number, number]): Scene {
    const scene = buildOrbitScene(orbitCase({ frameCount: 3 }));
    scene.entities[0].constraints = constraints;
    scene.targets = targets;
    if (pathStart !== undefined) {
      const [x, y, z] = pathStart;
      scene.path = {
        points: [
          { x, y, z },
          { x: x + 10, y, z: z + 5 },
          { x: x + 20, y, z },
          { x: x + 30, y, z: z + 5 },
        ],
        closed: false,
      };
    }
    return scene;
  }

  it('followPath only, with the path starting at (1, 2, 3): position (1, 2, 3) and travelled[0] = 0', () => {
    const scene = sceneWith(
      [{ type: 'followPath', order: 0, influence: 1, speed: 0, startOffset: 0 }],
      {},
      [1, 2, 3],
    );
    const baked = bake(scene);
    near('followPath position', bakedPosition(baked, 0, 0, [0, 0, 0]), [1, 2, 3], 1e-9);
    expect(baked.travelled[0][0]).toBe(0);
  });

  it('aimAt only, at target (0, 0, 5): aim direction (0, 0, 1)', () => {
    const scene = sceneWith(
      [{ type: 'aimAt', order: 0, influence: 1, target: 'goal' }],
      { goal: { x: 0, y: 0, z: 5 } },
    );
    const baked = bake(scene);
    const a = baked.aimDirections[0];
    near('aim direction', [a[0], a[1], a[2]], [0, 0, 1]);
  });

  it('orbitAround only (+Y, radius 5, centre origin, startAngle 90): position (5, 0, 0), not a path point', () => {
    const scene = sceneWith(
      [{ type: 'orbitAround', order: 0, influence: 1, target: 'centre', radius: 5, axis: '+Y', speed: 0, startAngle: 90 }],
      { centre: { x: 0, y: 0, z: 0 } },
    );
    const baked = bake(scene);
    const p = bakedPosition(baked, 0, 0, [0, 0, 0]);
    near('orbit position', p, [5, 0, 0]);
    for (const pt of scene.path.points) {
      const d = Math.abs(p[0] - pt.x) + Math.abs(p[1] - pt.y) + Math.abs(p[2] - pt.z);
      if (d < 1e-6) throw new Error(`orbit position [${p.join(', ')}] equals path point (${pt.x}, ${pt.y}, ${pt.z})`);
    }
    expect(baked.travelled[0][0]).toBe(0);
    expect(baked.heldFromFrame[0]).toBe(-1);
  });
});

describe('types and export surface (Requirements 1.1 to 1.4)', () => {
  it('a typed OrbitAroundConstraint literal sits in a Constraint list', () => {
    const c: OrbitAroundConstraint = {
      type: 'orbitAround',
      order: 0,
      influence: 1,
      target: 'centre',
      radius: 5,
      axis: '+Y',
      speed: 90,
      startAngle: 0,
    };
    const list: Constraint[] = [c];
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('orbitAround');
  });

  it('src/index.ts names OrbitAroundConstraint once, inside the export type block from scene.js', () => {
    const text = readFileSync(fileURLToPath(new URL('../../src/index.ts', import.meta.url)), 'utf8');
    const occurrences = text.split('OrbitAroundConstraint').length - 1;
    expect(occurrences).toBe(1);
    const match = /export type \{([^}]*)\} from '\.\/scene\.js'/.exec(text);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('OrbitAroundConstraint');
    expect(text).not.toMatch(/export \{[^}]*OrbitAroundConstraint/);
  });
});

// ---------------------------------------------------------------------------
// Source-text structure tests (Requirements 2.2, 5.1, 5.3, 5.4, 5.9, 5.12, 7.3, 7.4, 7.8)
// These read src/bake.ts as text. They pin the shape of the explicit dispatch, the absence of
// per-frame allocation in applyOrbitAround, and the single degree-to-radian conversion.
// ---------------------------------------------------------------------------

const BAKE_SOURCE = readFileSync(fileURLToPath(new URL('../../src/bake.ts', import.meta.url)), 'utf8');

/** Index of the character that closes the bracket opened at `openIndex`. Counts nesting. */
function closingIndex(text: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`no closing "${close}" for the "${open}" at index ${openIndex}`);
}

/** The text between the braces of `function <name>(...) { ... }`. */
function functionBody(text: string, name: string): string {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found in src/bake.ts`);
  const openParen = start + `function ${name}`.length;
  const closeParen = closingIndex(text, openParen, '(', ')');
  const openBrace = text.indexOf('{', closeParen);
  const closeBrace = closingIndex(text, openBrace, '{', '}');
  return text.slice(openBrace + 1, closeBrace);
}

/** The text between the braces of the first `switch (c.type) { ... }` in `body`. */
function switchBlock(body: string): string {
  const start = body.indexOf('switch (c.type)');
  if (start < 0) throw new Error('no "switch (c.type)" found');
  const openBrace = body.indexOf('{', start);
  const closeBrace = closingIndex(body, openBrace, '{', '}');
  return body.slice(openBrace + 1, closeBrace);
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Returns the first allocation-like text found in `body`, or null. Detects object creation, closures,
 * template literals, spread, allocating array methods, and array or object literals used as values.
 */
function findAllocation(body: string): string | null {
  const text = stripComments(body);
  const patterns: RegExp[] = [
    /\bnew\s/,
    /=>/,
    /\bfunction\b/,
    /`/,
    /\.\.\./,
    /\.(map|filter|slice|concat|reduce|forEach)\(/,
    // an array literal used as a value: "[" after = ( , : ? return or an operator (not after an identifier, ")" or "]")
    /(^|[=(,:?+\-*\/%<>!&|^~]|\breturn)\s*\[/,
    // an object literal used as a value: "{" after = ( , : ? or return (not after ")", else or "{")
    /(^|[=(,:?]|\breturn)\s*\{/,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m !== null) return m[0].trim() === '' ? p.source : `${m[0].trim()} (pattern ${p.source})`;
  }
  return null;
}

describe('source text: explicit dispatch (Requirements 5.1, 5.3, 5.4, 5.12)', () => {
  const bakeEntityBody = functionBody(BAKE_SOURCE, 'bakeEntity');
  const entitySwitch = switchBlock(bakeEntityBody);
  const drivesBody = functionBody(BAKE_SOURCE, 'drivesRotation');

  for (const [label, text] of [
    ['the switch of bakeEntity', entitySwitch],
    ['the body of drivesRotation', drivesBody],
  ] as const) {
    it(`${label} names all three constraint types and ends in a default that throws unknownConstraintType`, () => {
      expect(text).toContain("case 'aimAt'");
      expect(text).toContain("case 'followPath'");
      expect(text).toContain("case 'orbitAround'");
      expect(text).toMatch(/default:\s*(\{\s*)?throw unknownConstraintType\(/);
    });

    it(`${label} has no else fall-through that treats a non-aimAt as followPath`, () => {
      expect(stripComments(text)).not.toMatch(/\belse\b/);
      expect(stripComments(text)).not.toMatch(/\bisAimAt\(/);
    });
  }

  it('bakeEntity no longer has an if (isAimAt(c)) branch', () => {
    expect(stripComments(bakeEntityBody)).not.toMatch(/if\s*\(\s*isAimAt\(c\)\s*\)/);
  });

  it('the bakeEntity switch applies applyOrbitAround in the orbitAround case and writes no bookkeeping there', () => {
    const start = entitySwitch.indexOf("case 'orbitAround'");
    const end = entitySwitch.indexOf('default:', start);
    const orbitCaseText = entitySwitch.slice(start, end);
    expect(orbitCaseText).toContain('applyOrbitAround(');
    expect(orbitCaseText).not.toMatch(/travelled|heldFromFrame|aimDirections|writeAimDirection/);
  });

  it('drivesRotation: aimAt returns true, orbitAround returns false', () => {
    expect(drivesBody).toMatch(/case 'aimAt':\s*return true/);
    expect(drivesBody).toMatch(/case 'orbitAround':\s*return false/);
    expect(drivesBody).toMatch(/case 'followPath':\s*return alignsToPath\(c\)/);
  });
});

describe('source text: sceneNeedsFrames ignores an orbit (Requirement 5.9)', () => {
  it('tests isFollowPath(c) and alignsToPath(c) and does not mention an orbit', () => {
    const body = stripComments(functionBody(BAKE_SOURCE, 'sceneNeedsFrames'));
    expect(body).toContain('isFollowPath(c)');
    expect(body).toContain('alignsToPath(c)');
    expect(body).not.toMatch(/orbit/i);
  });
});

describe('source text: applyOrbitAround does not allocate per frame (Requirement 7.3)', () => {
  it('the checker flags known-bad strings', () => {
    for (const bad of ['new Foo()', '[1, 2]', '{ x: 1 }', '() => 1', 'const a = `x`;', 'f(...args)', 'a.map(f)', 'const a = [1];', 'return { x: 1 };']) {
      expect(findAllocation(bad), `should flag: ${bad}`).not.toBeNull();
    }
  });

  it('the checker accepts known-good strings', () => {
    for (const good of ['t[i]', 'if (a) { b = 1; }', 'x = a[0] + b[1];', 'if (a) { b = 1; } else { b = 2; }', 'p.x = c.x + r * (cos * a.z + sin * a.y);']) {
      expect(findAllocation(good), `should accept: ${good}`).toBeNull();
    }
  });

  it('the checker ignores allocation words inside comments', () => {
    expect(findAllocation('// new Foo() and [1, 2]\n/* () => 1 */ x = 1;')).toBeNull();
  });

  it('applyOrbitAround contains no allocation', () => {
    const body = functionBody(BAKE_SOURCE, 'applyOrbitAround');
    const found = findAllocation(body);
    if (found !== null) throw new Error(`applyOrbitAround allocates: ${found}`);
  });
});

describe('source text: degrees become radians once (Requirements 2.2, 7.8)', () => {
  const body = stripComments(functionBody(BAKE_SOURCE, 'applyOrbitAround'));

  it('contains exactly one Math.PI, on the statement that defines angle', () => {
    const count = body.split('Math.PI').length - 1;
    expect(count).toBe(1);
    const line = body.split('\n').find((l) => l.includes('Math.PI'));
    expect(line).toBeDefined();
    expect(line!.trim()).toMatch(/^const angle\s*=/);
  });

  it('applies Math.cos and Math.sin once each, both to angle', () => {
    expect(body.split('Math.cos(').length - 1).toBe(1);
    expect(body.split('Math.sin(').length - 1).toBe(1);
    expect(body).toContain('Math.cos(angle)');
    expect(body).toContain('Math.sin(angle)');
  });

  it('works out the angle in degrees before the single conversion', () => {
    expect(body).toMatch(/const angleDeg\s*=\s*c\.startAngle \+ \(c\.speed \* frame\) \/ fps;/);
  });
});

describe('source text: no axis token and no camera in applyOrbitAround (Requirement 7.4)', () => {
  const body = functionBody(BAKE_SOURCE, 'applyOrbitAround');

  it('contains no quoted axis token', () => {
    expect(body).not.toMatch(/['"`][+-][XYZ]['"`]/);
  });

  it('does not mention a camera, in any letter case', () => {
    expect(body).not.toMatch(/camera/i);
  });
});
