import { describe, it } from 'vitest';
import fc from 'fast-check';
import { SceneError, validateScene } from '../../src/scene.js';
import type { Scene } from '../../src/scene.js';
import { INVALID_KINDS, arbValidScene, invalidSceneByKind } from './scene-generators.js';

describe('scene generators (self-check)', () => {
  it('every valid scene passes validateScene (500 samples)', () => {
    const scenes = fc.sample(arbValidScene, { numRuns: 500, seed: 7201 });
    for (let i = 0; i < scenes.length; i++) {
      try {
        validateScene(scenes[i]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`valid scene sample ${i} was rejected: ${msg}`);
      }
    }
  });

  for (const kind of INVALID_KINDS) {
    it(`invalid kind "${kind}" throws SceneError with the expected message (300 samples)`, () => {
      const cases = fc.sample(invalidSceneByKind[kind], { numRuns: 300, seed: 7202 });
      for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        let actual: string | null = null;
        let notSceneError: string | null = null;
        try {
          validateScene(c.scene);
        } catch (err) {
          if (err instanceof SceneError) actual = err.message;
          else notSceneError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        }
        if (notSceneError !== null) {
          throw new Error(`kind ${kind} sample ${i}: threw a non-SceneError (${notSceneError}); expected "${c.message}"`);
        }
        if (actual === null) {
          throw new Error(`kind ${kind} sample ${i}: validateScene did not throw; expected "${c.message}"`);
        }
        if (actual !== c.message) {
          throw new Error(`kind ${kind} sample ${i}: expected "${c.message}" but got "${actual}"`);
        }
      }
    });
  }

  it('valid scenes cover the required variety (1000 samples)', () => {
    const scenes: Scene[] = fc.sample(arbValidScene, { numRuns: 1000, seed: 7203 });
    const counts: Record<string, number> = {
      zeroEntities: 0,
      fourEntities: 0,
      openPath: 0,
      closedPath: 0,
      staticTarget: 0,
      keyframedTarget: 0,
      aimAt: 0,
      followPath: 0,
      influence0: 0,
      influence1: 0,
      fps24: 0,
      fps30: 0,
      fps60: 0,
      frameCount1: 0,
      frameCountOver100: 0,
      alignToPathOmitted: 0,
    };
    for (const s of scenes) {
      if (s.entities.length === 0) counts.zeroEntities++;
      if (s.entities.length === 4) counts.fourEntities++;
      if (s.path.closed) counts.closedPath++;
      else counts.openPath++;
      if (s.fps === 24) counts.fps24++;
      if (s.fps === 30) counts.fps30++;
      if (s.fps === 60) counts.fps60++;
      if (s.frameCount === 1) counts.frameCount1++;
      if (s.frameCount > 100) counts.frameCountOver100++;
      for (const name of Object.keys(s.targets)) {
        if ('keyframes' in s.targets[name]) counts.keyframedTarget++;
        else counts.staticTarget++;
      }
      for (const e of s.entities) {
        for (const c of e.constraints) {
          if (c.type === 'aimAt') counts.aimAt++;
          else {
            counts.followPath++;
            if (!('alignToPath' in c)) counts.alignToPathOmitted++;
          }
          if (c.influence === 0) counts.influence0++;
          if (c.influence === 1) counts.influence1++;
        }
      }
    }
    console.log(
      'scene variety counts: ' +
        Object.keys(counts)
          .map((k) => `${k}=${counts[k]}`)
          .join(' '),
    );
    const missing = Object.keys(counts).filter((k) => counts[k] === 0);
    if (missing.length > 0) {
      throw new Error(`valid scenes never produced: ${missing.join(', ')}`);
    }
  });
});
