import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  pauseTour,
  resumeTour,
  selectPart,
  setExplode,
  setLook,
  setMachine,
  setOffset,
  setOrbitAngle,
  setZoom,
  startTour,
  stopTour,
  toggleMode,
} from '../src/state.js';
import type { AppState } from '../src/state.js';

// Requirements 15.3, 15.4, 16.2, 16.6, 16.11, 35.17. Design Property 19.
// All expected values are typed in by hand. Drag_Range limit: L(e) = 0.25 - 0.0015 * e.
const TOL = 1e-9;

function near(name: string, index: number, got: number, expected: number): void {
  if (!(Math.abs(got - expected) <= TOL)) {
    throw new Error(`${name}: index ${index}, expected ${expected}, got ${got}`);
  }
}

function same(name: string, index: number, got: unknown, expected: unknown): void {
  if (got !== expected) {
    throw new Error(`${name}: index ${index}, expected ${String(expected)}, got ${String(got)}`);
  }
}

describe('initial state', () => {
  it('starts with angle 30, zoom 0.25, explode 0, Pump, zero offset and an idle Tour', () => {
    const s = createInitialState();
    expect(s.machine).toBe('pump');
    expect(s.orbitAngleDeg).toBe(30);
    expect(s.zoom).toBe(0.25);
    expect(s.explode).toBe(0);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(0);
    expect(s.mode).toBe('rotate');
    expect(s.selectedPart).toBeNull();
    expect(s.look).toBe('X_Ray_Skeleton');
    expect(s.tour.status).toBe('idle');
    expect(s.tour.savedAngleDeg).toBe(30);
    expect(s.tour.savedZoom).toBe(0.25);
    expect(createInitialState('Clean_Engineering').look).toBe('Clean_Engineering');
  });
});

describe('setters', () => {
  it('sets the orbit angle and keeps everything else; non-finite throws with the value', () => {
    const s = createInitialState();
    const a = setOrbitAngle(s, 200);
    expect(a.orbitAngleDeg).toBe(200);
    expect(a.zoom).toBe(0.25);
    expect(a.machine).toBe('pump');
    expect(setOrbitAngle(s, -45).orbitAngleDeg).toBe(-45);
    expect(s.orbitAngleDeg).toBe(30);
    expect(() => setOrbitAngle(s, Number.NaN)).toThrow(/NaN/);
    expect(() => setOrbitAngle(s, Infinity)).toThrow(/Infinity/);
  });

  it('clamps zoom to 0 to 1; non-finite throws', () => {
    const s = createInitialState();
    const table: ReadonlyArray<readonly [number, number]> = [
      [-0.5, 0],
      [0, 0],
      [0.4, 0.4],
      [1, 1],
      [1.5, 1],
    ];
    for (let i = 0; i < table.length; i++) {
      same('zoom check', i, setZoom(s, table[i][0]).zoom, table[i][1]);
    }
    expect(() => setZoom(s, Number.NaN)).toThrow(/NaN/);
  });

  it('clamps explode to 0 to 100 and re-clamps the offset to the new Drag_Range', () => {
    // [start explode, start offset x, y, new explode, expected explode, expected x, expected y]
    const base = setOffset(createInitialState(), 0.25, -0.25);
    expect(base.offsetX).toBe(0.25);
    expect(base.offsetY).toBe(-0.25);
    const table: ReadonlyArray<readonly [number, number, number, number]> = [
      [50, 50, 0.175, -0.175],
      [100, 100, 0.1, -0.1],
      [150, 100, 0.1, -0.1],
      [-10, 0, 0.25, -0.25],
    ];
    for (let i = 0; i < table.length; i++) {
      const s = setExplode(base, table[i][0]);
      same('explode check', i, s.explode, table[i][1]);
      near('offset x check', i, s.offsetX, table[i][2]);
      near('offset y check', i, s.offsetY, table[i][3]);
    }
    // Raising then lowering does not bring the lost offset back.
    const back = setExplode(setExplode(base, 100), 0);
    near('offset x after 100 then 0', 0, back.offsetX, 0.1);
    near('offset y after 100 then 0', 0, back.offsetY, -0.1);
    expect(() => setExplode(base, Number.NaN)).toThrow(/NaN/);
  });

  it('clamps the offset by the Drag_Range at the current explode', () => {
    const at0 = createInitialState();
    const at50 = setExplode(at0, 50);
    const table: ReadonlyArray<readonly [AppState, number, number, number, number]> = [
      [at0, 0.1, -0.2, 0.1, -0.2],
      [at0, 0.4, -0.4, 0.25, -0.25],
      [at50, 0.2, 0.1, 0.175, 0.1],
      [at50, -0.3, 0.3, -0.175, 0.175],
    ];
    for (let i = 0; i < table.length; i++) {
      const s = setOffset(table[i][0], table[i][1], table[i][2]);
      near('offset x check', i, s.offsetX, table[i][3]);
      near('offset y check', i, s.offsetY, table[i][4]);
    }
    expect(() => setOffset(at0, Number.NaN, 0)).toThrow(/NaN/);
    expect(() => setOffset(at0, 0, -Infinity)).toThrow(/-Infinity/);
  });

  it('toggles the mode, selects a Part and sets the Look', () => {
    const s = createInitialState();
    const moved = toggleMode(s);
    expect(moved.mode).toBe('move');
    expect(toggleMode(moved).mode).toBe('rotate');
    expect(selectPart(s, 'impeller').selectedPart).toBe('impeller');
    expect(selectPart(selectPart(s, 'impeller'), null).selectedPart).toBeNull();
    expect(setLook(s, 'Clean_Engineering').look).toBe('Clean_Engineering');
    expect(s.mode).toBe('rotate');
    expect(s.selectedPart).toBeNull();
    expect(s.look).toBe('X_Ray_Skeleton');
  });
});

describe('switching Machine', () => {
  it('resets explode, offset and selection, and keeps angle, zoom, mode and Look', () => {
    let s = createInitialState('Clean_Engineering');
    s = setOrbitAngle(s, 120);
    s = setZoom(s, 0.8);
    s = setExplode(s, 60);
    s = setOffset(s, 0.1, -0.1);
    s = toggleMode(s);
    s = selectPart(s, 'impeller');
    const n = setMachine(s, 'desk-lamp');
    expect(n.machine).toBe('desk-lamp');
    expect(n.explode).toBe(0);
    expect(n.offsetX).toBe(0);
    expect(n.offsetY).toBe(0);
    expect(n.selectedPart).toBeNull();
    expect(n.orbitAngleDeg).toBe(120);
    expect(n.zoom).toBe(0.8);
    expect(n.mode).toBe('move');
    expect(n.look).toBe('Clean_Engineering');
    expect(s.explode).toBe(60);
    expect(s.selectedPart).toBe('impeller');
  });
});

describe('Tour', () => {
  it('start resets explode and offset and saves angle and zoom; stop restores them (several start states)', () => {
    // [angle, zoom, explode, offset x, offset y, angle the Tour moved to, zoom the Tour moved to]
    const table: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
      [30, 0.25, 0, 0, 0, 100, 0.9],
      [200, 0.9, 50, 0.1, -0.1, 10, 0],
      [-45, 0, 100, 0.08, -0.05, 359, 1],
      [720.5, 1, 20, -0.2, 0.2, 0, 0.5],
    ];
    for (let i = 0; i < table.length; i++) {
      const [angle, zoom, explode, ox, oy, tourAngle, tourZoom] = table[i];
      let s = createInitialState();
      s = setOrbitAngle(s, angle);
      s = setZoom(s, zoom);
      s = setExplode(s, explode);
      s = setOffset(s, ox, oy);
      near('offset x before start', i, s.offsetX, ox);
      near('offset y before start', i, s.offsetY, oy);

      const started = startTour(s);
      same('status after start', i, started.tour.status, 'playing');
      same('explode after start', i, started.explode, 0);
      same('offset x after start', i, started.offsetX, 0);
      same('offset y after start', i, started.offsetY, 0);
      same('saved angle', i, started.tour.savedAngleDeg, angle);
      same('saved zoom', i, started.tour.savedZoom, zoom);

      // The Tour moves the camera; stop must still give back the saved view.
      const moving: AppState = { ...started, orbitAngleDeg: tourAngle, zoom: tourZoom };
      const stopped = stopTour(moving);
      same('status after stop', i, stopped.tour.status, 'idle');
      same('angle after stop', i, stopped.orbitAngleDeg, angle);
      same('zoom after stop', i, stopped.zoom, zoom);
      same('explode after stop', i, stopped.explode, 0);
      same('offset x after stop', i, stopped.offsetX, 0);
      same('offset y after stop', i, stopped.offsetY, 0);
      same('machine after stop', i, stopped.machine, 'pump');
    }
  });

  it('pause keeps the saved view, resume saves nothing again, and stop works from paused', () => {
    let s = setOrbitAngle(setZoom(createInitialState(), 0.7), 90);
    s = startTour(s);
    const paused = pauseTour({ ...s, orbitAngleDeg: 150, zoom: 0.1 });
    expect(paused.tour.status).toBe('paused');
    expect(paused.tour.savedAngleDeg).toBe(90);
    expect(paused.tour.savedZoom).toBe(0.7);
    const resumed = resumeTour(paused);
    expect(resumed.tour.status).toBe('playing');
    expect(resumed.tour.savedAngleDeg).toBe(90);
    expect(resumed.tour.savedZoom).toBe(0.7);
    expect(startTour(resumed)).toBe(resumed); // start while playing does nothing
    const stoppedFromPause = stopTour(paused);
    expect(stoppedFromPause.tour.status).toBe('idle');
    expect(stoppedFromPause.orbitAngleDeg).toBe(90);
    expect(stoppedFromPause.zoom).toBe(0.7);
    const idle = createInitialState();
    expect(pauseTour(idle)).toBe(idle);
    expect(resumeTour(idle)).toBe(idle);
    expect(stopTour(idle)).toBe(idle);
  });

  it('rejects the orbit, zoom, explode and move setters while the Tour plays, with no change', () => {
    const playing = startTour(setOffset(setExplode(createInitialState(), 40), 0.1, 0.1));
    expect(playing.tour.status).toBe('playing');
    expect(setOrbitAngle(playing, 200)).toBe(playing);
    expect(setZoom(playing, 0.9)).toBe(playing);
    expect(setExplode(playing, 80)).toBe(playing);
    expect(setOffset(playing, 0.2, 0.2)).toBe(playing);
    expect(playing.orbitAngleDeg).toBe(30);
    expect(playing.zoom).toBe(0.25);
    expect(playing.explode).toBe(0);
    expect(playing.offsetX).toBe(0);
    // After stop the setters work again.
    const stopped = stopTour(playing);
    expect(setOrbitAngle(stopped, 200).orbitAngleDeg).toBe(200);
    expect(setZoom(stopped, 0.9).zoom).toBe(0.9);
    expect(setExplode(stopped, 80).explode).toBe(80);
    near('offset x after stop', 0, setOffset(stopped, 0.2, 0.2).offsetX, 0.2);
  });
});
