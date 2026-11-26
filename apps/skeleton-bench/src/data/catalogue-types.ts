// Types for the Part_Catalogue. Layout only: no machine facts live in this file.
// Units: metres. Y-up, right-handed.

export type Vec3 = readonly [number, number, number];

export type MachineId = 'pump' | 'heat-exchanger' | 'desk-lamp';

// One Part. The catalogue is the single source for explode paths, the Inspector
// and the keyboard order.
export interface PartEntry {
  readonly id: string; // unique across all Machines
  readonly name: string;
  readonly job: string;
  readonly material: string;
  readonly positionText: string;
  readonly sourceId: string; // must exist in docs/sources.md
  readonly restPosition: Vec3; // m, inside the envelope
  readonly explodeVector: Vec3; // m, length at least PART_MIN_EXPLODE_M; end position inside the envelope
  readonly extents: Vec3; // m, full size along x, y, z; used by the envelope check
}

// One Machine. partIds is the keyboard order and also the tour order.
// The model builder is added with the render code, not here.
export interface MachineEntry {
  readonly id: MachineId;
  readonly name: string;
  readonly partIds: readonly string[];
}

export interface Catalogue {
  readonly machines: readonly MachineEntry[];
  readonly parts: readonly PartEntry[];
}
