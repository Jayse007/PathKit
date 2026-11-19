import { describe, it, expect } from 'vitest';
import type { Frame } from '../../src/frames.js';
import { stepTwists, totalTwist } from './twist.js';

// Sanity checks of the twist helper itself (used by Property 17).

describe('twist helper', () => {
  it('reports 0.3 for normals differing by 0.3 rad about a shared tangent', () => {
    const tangent = { x: 0, y: 0, z: 1 };
    const make = (angle: number): Frame => {
      const normal = { x: Math.cos(angle), y: Math.sin(angle), z: 0 };
      // binormal = tangent x normal
      const binormal = { x: -normal.y, y: normal.x, z: 0 };
      return { position: { x: 0, y: 0, z: 0 }, tangent, normal, binormal };
    };
    const frames = [make(0), make(0.3)];
    const steps = stepTwists(frames);
    expect(steps.length).toBe(1);
    expect(Math.abs(steps[0] - 0.3)).toBeLessThan(1e-9);
    expect(Math.abs(totalTwist(frames) - 0.3)).toBeLessThan(1e-9);
  });

  it('reports no twist for a planar circle with normals pointing at the centre', () => {
    const radius = 5;
    const samples = 100;
    const frames: Frame[] = [];
    for (let i = 0; i < samples; i++) {
      const phi = (2 * Math.PI * i) / samples;
      const tangent = { x: -Math.sin(phi), y: Math.cos(phi), z: 0 };
      const normal = { x: -Math.cos(phi), y: -Math.sin(phi), z: 0 };
      // binormal = tangent x normal
      const binormal = {
        x: tangent.y * normal.z - tangent.z * normal.y,
        y: tangent.z * normal.x - tangent.x * normal.z,
        z: tangent.x * normal.y - tangent.y * normal.x,
      };
      const position = { x: radius * Math.cos(phi), y: radius * Math.sin(phi), z: 0 };
      frames.push({ position, tangent, normal, binormal });
    }
    expect(totalTwist(frames)).toBeLessThan(1e-9);
  });
});
