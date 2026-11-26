// Pure catalogue checks. Each function returns a list of failure messages
// (empty list = pass). Every message names the Part (or Machine) at fault.
// No file access here: the test reads docs/sources.md and passes the ids in.

import {
  EXPLODED_BOX_HALF_X,
  EXPLODED_BOX_HALF_Y,
  EXPLODED_BOX_HALF_Z,
  PART_MIN_EXPLODE_M,
} from '../constants.js';
import type { Catalogue, MachineId, PartEntry, Vec3 } from './catalogue-types.js';

// The placeholder fixture from Task 13.1. Only this exact Part may use it.
export const FIXTURE_SOURCE_ID = 'fixture';
export const FIXTURE_PART_ID = 'fixture-part';

// Part names the brief requires (Requirement 18.1 to 18.3), lower case.
// Matching ignores case and a trailing "(...)" note, so "Bolts (one group)" matches "bolts".
export const EXPECTED_PART_NAMES: Readonly<Record<MachineId, readonly string[]>> = {
  pump: [
    'casing',
    'impeller',
    'shaft',
    'bearing housing',
    'mechanical seal',
    'flange',
    'bolts',
    'motor',
  ],
  'heat-exchanger': ['shell', 'tube bundle', 'tube sheet', 'baffles', 'channel head', 'nozzles'],
  'desk-lamp': ['base', 'lower arm', 'upper arm', 'joint', 'shade', 'bulb holder'],
};

export function isFixturePart(part: PartEntry): boolean {
  return part.id === FIXTURE_PART_ID && part.sourceId === FIXTURE_SOURCE_ID;
}

// Reads the Id column of the table in docs/sources.md.
export function parseSourceIds(markdown: string): string[] {
  const ids: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|');
    const first = (cells[1] ?? '').trim();
    if (first === '' || first === 'Id' || /^:?-+:?$/.test(first)) continue;
    ids.push(first);
  }
  return ids;
}

function isNonEmptyText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function label(part: PartEntry): string {
  return `Part "${String(part.id)}"`;
}

export function checkFieldsPresent(catalogue: Catalogue): string[] {
  const failures: string[] = [];
  for (const part of catalogue.parts) {
    for (const key of ['id', 'name', 'job', 'material', 'positionText', 'sourceId'] as const) {
      if (!isNonEmptyText(part[key])) failures.push(`${label(part)}: field ${key} is missing or empty`);
    }
    for (const key of ['restPosition', 'explodeVector', 'extents'] as const) {
      if (!isVec3(part[key])) failures.push(`${label(part)}: field ${key} is not three finite numbers`);
    }
    if (isVec3(part.extents) && part.extents.some((e) => e <= 0)) {
      failures.push(`${label(part)}: extents must all be above 0`);
    }
  }
  for (const machine of catalogue.machines) {
    if (!isNonEmptyText(machine.id)) failures.push('Machine: id is missing or empty');
    if (!isNonEmptyText(machine.name)) failures.push(`Machine "${machine.id}": name is missing or empty`);
    if (machine.partIds.length === 0) failures.push(`Machine "${machine.id}": has no Parts`);
  }
  return failures;
}

export function checkUniqueIds(catalogue: Catalogue): string[] {
  const failures: string[] = [];
  const seenParts = new Set<string>();
  for (const part of catalogue.parts) {
    if (seenParts.has(part.id)) failures.push(`${label(part)}: id is used more than once`);
    seenParts.add(part.id);
  }
  const seenMachines = new Set<string>();
  for (const machine of catalogue.machines) {
    if (seenMachines.has(machine.id)) failures.push(`Machine "${machine.id}": id is used more than once`);
    seenMachines.add(machine.id);
  }
  return failures;
}

// Every Part appears exactly once across all keyboard orders, and every listed id is a Part.
export function checkKeyboardOrder(catalogue: Catalogue): string[] {
  const failures: string[] = [];
  const known = new Set(catalogue.parts.map((p) => p.id));
  const counts = new Map<string, number>();
  for (const machine of catalogue.machines) {
    for (const id of machine.partIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (!known.has(id)) failures.push(`Machine "${machine.id}": keyboard order lists unknown Part "${id}"`);
    }
  }
  for (const part of catalogue.parts) {
    const n = counts.get(part.id) ?? 0;
    if (n !== 1) failures.push(`${label(part)}: listed ${n} times in keyboard orders, expected 1`);
  }
  return failures;
}

export function checkSourceIds(catalogue: Catalogue, sourceIds: readonly string[]): string[] {
  const failures: string[] = [];
  const known = new Set(sourceIds);
  for (const part of catalogue.parts) {
    if (isFixturePart(part)) continue;
    if (!known.has(part.sourceId)) {
      failures.push(`${label(part)}: source id "${part.sourceId}" is not in docs/sources.md`);
    }
  }
  return failures;
}

export function checkExplodeLength(catalogue: Catalogue): string[] {
  const failures: string[] = [];
  for (const part of catalogue.parts) {
    if (!isVec3(part.explodeVector)) continue; // reported by checkFieldsPresent
    const [x, y, z] = part.explodeVector;
    const length = Math.sqrt(x * x + y * y + z * z);
    if (!(length >= PART_MIN_EXPLODE_M)) {
      failures.push(`${label(part)}: explode vector length ${length} m is below ${PART_MIN_EXPLODE_M} m`);
    }
  }
  return failures;
}

const HALF: Vec3 = [EXPLODED_BOX_HALF_X, EXPLODED_BOX_HALF_Y, EXPLODED_BOX_HALF_Z];
const AXES = ['x', 'y', 'z'] as const;

// A box centred on `centre` with the Part's extents must lie inside the envelope.
function boxFailures(part: PartEntry, what: string, centre: Vec3): string[] {
  const failures: string[] = [];
  for (let i = 0; i < 3; i++) {
    const half = part.extents[i]! / 2;
    const lo = centre[i]! - half;
    const hi = centre[i]! + half;
    if (lo < -HALF[i]! || hi > HALF[i]!) {
      failures.push(
        `${label(part)}: ${what} leaves the envelope on ${AXES[i]} (${lo} to ${hi}, limit +-${HALF[i]})`,
      );
    }
  }
  return failures;
}

export function checkEnvelope(catalogue: Catalogue): string[] {
  const failures: string[] = [];
  for (const part of catalogue.parts) {
    if (!isVec3(part.restPosition) || !isVec3(part.explodeVector) || !isVec3(part.extents)) continue;
    failures.push(...boxFailures(part, 'rest position', part.restPosition));
    const end: Vec3 = [
      part.restPosition[0] + part.explodeVector[0],
      part.restPosition[1] + part.explodeVector[1],
      part.restPosition[2] + part.explodeVector[2],
    ];
    failures.push(...boxFailures(part, 'end position', end));
  }
  return failures;
}

function normaliseName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
}

// Lists exactly the named Parts for one Machine, in any order, no extras, no missing.
export function checkNamedParts(catalogue: Catalogue, machineId: MachineId, expected: readonly string[]): string[] {
  const machine = catalogue.machines.find((m) => m.id === machineId);
  if (machine === undefined) return [`Machine "${machineId}": not in the catalogue`];
  const failures: string[] = [];
  const byId = new Map(catalogue.parts.map((p) => [p.id, p] as const));
  const found: string[] = [];
  for (const id of machine.partIds) {
    const part = byId.get(id);
    if (part === undefined) continue; // reported by checkKeyboardOrder
    const name = normaliseName(part.name);
    found.push(name);
    if (!expected.includes(name)) failures.push(`${label(part)}: name "${part.name}" is not a named ${machineId} Part`);
  }
  for (const name of expected) {
    const n = found.filter((f) => f === name).length;
    if (n === 0) failures.push(`Machine "${machineId}": missing Part "${name}"`);
    if (n > 1) failures.push(`Machine "${machineId}": Part "${name}" listed ${n} times`);
  }
  return failures;
}
