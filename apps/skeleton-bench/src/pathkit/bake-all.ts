// Bake at load: four laps, one scene per Part, one Tour per Machine.
// Call once at load, never while the User drags, zooms or moves a slider.
// Each Tour is validated (bake calls validateScene) and checked with motionLinter.
// A failure is returned as a plain message, never thrown, so the UI can show it.
import {
  bake,
  motionLinter,
  type BakedData,
  type Finding,
  type Scene,
  type Vec3,
} from '../pathkit-api.js';
import { CATALOGUE } from '../data/catalogue.js';
import type { Catalogue, MachineId } from '../data/catalogue-types.js';
import { findingsToPlainText } from '../logic/finding-text.js';
import { bakeLaps } from './laps.js';
import { bakeParts } from './part-scenes.js';
import { buildTourScene } from './tour.js';

/** One baked Tour with its linter result. */
export interface BakedTour {
  readonly machine: MachineId;
  readonly partIds: readonly string[]; // tour order = keyboard order
  readonly scene: Scene;
  readonly baked: BakedData;
  readonly findings: readonly Finding[];
  /** Plain sentences for the Motion_Check. One line "No findings reported." when empty. */
  readonly findingLines: readonly string[];
}

export interface BakeAllSuccess {
  readonly ok: true;
  readonly laps: readonly BakedData[];
  readonly parts: ReadonlyMap<string, BakedData>;
  readonly tours: ReadonlyMap<MachineId, BakedTour>;
}

export interface BakeAllFailure {
  readonly ok: false;
  /** States what failed and what the User can do next (Requirement 16.9). */
  readonly message: string;
}

export type BakeAllResult = BakeAllSuccess | BakeAllFailure;

/** Message for a failed bake or lint. Says what failed and what the User can do. */
export function bakeFailureMessage(stage: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `The ${stage} could not be prepared (${detail}). Reload the page to try again. If it happens again, the Tour is unavailable but the rest of the app still works.`;
}

/** Bake and lint the Tour of one Machine. Throws on failure; bakeAll catches it. */
export function bakeTour(machine: MachineId, catalogue: Catalogue = CATALOGUE): BakedTour {
  const entry = catalogue.machines.find((m) => m.id === machine);
  if (entry === undefined) {
    throw new Error(`bakeTour: unknown machine "${machine}"`);
  }
  const rest: Vec3[] = entry.partIds.map((id): Vec3 => {
    const part = catalogue.parts.find((p) => p.id === id);
    if (part === undefined) {
      throw new Error(`bakeTour: machine "${machine}" lists unknown part "${id}"`);
    }
    return { x: part.restPosition[0], y: part.restPosition[1], z: part.restPosition[2] };
  });
  const scene = buildTourScene(rest);
  const baked = bake(scene);
  const findings = motionLinter(scene, baked);
  return {
    machine,
    partIds: entry.partIds,
    scene,
    baked,
    findings,
    findingLines: findingsToPlainText(findings),
  };
}

/** Bake laps, Part scenes and all Tours. Never throws: a failure gives { ok: false, message }. */
export function bakeAll(catalogue: Catalogue = CATALOGUE): BakeAllResult {
  let laps: BakedData[];
  try {
    laps = bakeLaps();
  } catch (error) {
    return { ok: false, message: bakeFailureMessage('camera laps', error) };
  }
  let parts: Map<string, BakedData>;
  try {
    parts = bakeParts(catalogue.parts);
  } catch (error) {
    return { ok: false, message: bakeFailureMessage('Part movements', error) };
  }
  const tours = new Map<MachineId, BakedTour>();
  for (const machine of catalogue.machines) {
    try {
      tours.set(machine.id, bakeTour(machine.id, catalogue));
    } catch (error) {
      return { ok: false, message: bakeFailureMessage(`Tour for ${machine.name}`, error) };
    }
  }
  return { ok: true, laps, parts, tours };
}
