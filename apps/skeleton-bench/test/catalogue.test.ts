import { describe, expect, it } from 'vitest';
import {
  checkEnvelope,
  checkExplodeLength,
  checkFieldsPresent,
  checkKeyboardOrder,
  checkNamedParts,
  checkSourceIds,
  checkUniqueIds,
  EXPECTED_PART_NAMES,
  isFixturePart,
  parseSourceIds,
} from '../src/data/catalogue-checks.js';
import type { Catalogue, MachineId, PartEntry } from '../src/data/catalogue-types.js';
import { CATALOGUE, FIXTURE_CATALOGUE, FIXTURE_PART } from '../src/data/catalogue.js';
import SOURCES_TEXT from '../docs/sources.md?raw';

// Property 18 (catalogue checks). Hand-written expected values only.
//
// While the catalogue holds only the one-Part fixture (Task 13.1), the tests that need real
// machine facts are SKIPPED, not weakened: the named-Parts checks for each Machine (run when
// that Machine has no fixture Part) and the 20-Part total (runs once all three Machines exist).
// The structural checks and the source-id check always run on CATALOGUE. The source-id check
// exempts only the exact fixture Part. Task 14 fills the Pump, Task 18 the other two.

function part(overrides: Partial<PartEntry>): PartEntry {
  return { ...FIXTURE_PART, ...overrides };
}

function catalogueOf(parts: PartEntry[], partIds: string[] = parts.map((p) => p.id)): Catalogue {
  return { machines: [{ id: 'pump', name: 'Test machine', partIds }], parts };
}

function expectNoFailures(failures: string[]): void {
  if (failures.length > 0) throw new Error(`catalogue check failed:\n${failures.join('\n')}`);
}

function machineIsReal(id: MachineId): boolean {
  const machine = CATALOGUE.machines.find((m) => m.id === id);
  if (machine === undefined) return false;
  return !CATALOGUE.parts.some((p) => machine.partIds.includes(p.id) && isFixturePart(p));
}

describe('parseSourceIds', () => {
  it('returns no ids for a table with only a header and a separator', () => {
    const text = '| Id | Part | Claim | Source | Date checked |\n| --- | --- | --- | --- | --- |\n';
    expect(parseSourceIds(text)).toEqual([]);
  });

  it('returns the first cell of each row, with CRLF line ends and other text ignored', () => {
    const text =
      '# Sources\r\n\r\n| Id | Part |\r\n| --- | --- |\r\n| pump-1 | Casing |\r\n| pump-2 | Shaft |\r\n';
    expect(parseSourceIds(text)).toEqual(['pump-1', 'pump-2']);
  });
});

describe('catalogue checks on the real catalogue', () => {
  it('every field is present', () => {
    expectNoFailures(checkFieldsPresent(CATALOGUE));
  });

  it('Part ids and Machine ids are unique across all Machines', () => {
    expectNoFailures(checkUniqueIds(CATALOGUE));
  });

  it('the keyboard order lists every Part exactly once', () => {
    expectNoFailures(checkKeyboardOrder(CATALOGUE));
  });

  it('every source id exists in docs/sources.md', () => {
    expectNoFailures(checkSourceIds(CATALOGUE, parseSourceIds(SOURCES_TEXT)));
  });

  it('every explode vector is at least 0.1 m long', () => {
    expectNoFailures(checkExplodeLength(CATALOGUE));
  });

  it('rest position, end position and extents are inside the envelope', () => {
    expectNoFailures(checkEnvelope(CATALOGUE));
  });
});

describe('lists exactly the named Parts', () => {
  it('runs against the fixture now (fixture expectation, not a machine fact)', () => {
    expectNoFailures(checkNamedParts(FIXTURE_CATALOGUE, 'pump', ['fixture part']));
  });

  const expectedCounts: ReadonlyArray<readonly [MachineId, number]> = [
    ['pump', 8],
    ['heat-exchanger', 6],
    ['desk-lamp', 6],
  ];

  // Skipped while the Machine still holds the fixture or is absent. Not weakened: the full
  // expected name list from the brief (Requirements 18.1 to 18.3) is used as soon as it runs.
  for (const [id, count] of expectedCounts) {
    it.skipIf(!machineIsReal(id))(`${id} lists exactly its ${count} named Parts (real catalogue)`, () => {
      expect(EXPECTED_PART_NAMES[id].length).toBe(count);
      expectNoFailures(checkNamedParts(CATALOGUE, id, EXPECTED_PART_NAMES[id]));
    });
  }

  it.skipIf(CATALOGUE.machines.length < 3)('the full catalogue has 20 Parts (8 + 6 + 6)', () => {
    expect(CATALOGUE.parts.length).toBe(20);
  });
});

describe('the checks catch bad data', () => {
  it('a duplicated Part id is reported by name', () => {
    const failures = checkUniqueIds(catalogueOf([part({ id: 'a' }), part({ id: 'a' })], ['a', 'a']));
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain('"a"');
  });

  it('a Part missing from the keyboard order, and a Part listed twice, are reported by name', () => {
    const parts = [part({ id: 'a' }), part({ id: 'b' })];
    const missing = checkKeyboardOrder(catalogueOf(parts, ['a']));
    expect(missing.length).toBe(1);
    expect(missing[0]).toContain('"b"');
    const twice = checkKeyboardOrder(catalogueOf(parts, ['a', 'b', 'a']));
    expect(twice.length).toBe(1);
    expect(twice[0]).toContain('"a"');
    expect(checkKeyboardOrder(catalogueOf(parts, ['b', 'a']))).toEqual([]);
  });

  it('a source id that is not in docs/sources.md is reported by name', () => {
    const cat = catalogueOf([part({ id: 'casing', sourceId: 'pump-9' })]);
    const failures = checkSourceIds(cat, ['pump-1']);
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain('"casing"');
    expect(failures[0]).toContain('pump-9');
    expect(checkSourceIds(cat, ['pump-1', 'pump-9'])).toEqual([]);
  });

  it('the fixture source id is accepted only for the exact fixture Part', () => {
    expect(checkSourceIds(catalogueOf([FIXTURE_PART]), [])).toEqual([]);
    const failures = checkSourceIds(catalogueOf([part({ id: 'casing', sourceId: 'fixture' })]), []);
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain('"casing"');
  });

  it('an explode vector of 0.09 m fails and 0.1 m passes', () => {
    const short = checkExplodeLength(catalogueOf([part({ id: 'a', explodeVector: [0.09, 0, 0] })]));
    expect(short.length).toBe(1);
    expect(short[0]).toContain('"a"');
    expect(checkExplodeLength(catalogueOf([part({ id: 'a', explodeVector: [0, 0.1, 0] })]))).toEqual([]);
    expect(checkExplodeLength(catalogueOf([part({ id: 'a', explodeVector: [0, 0, 0] })])).length).toBe(1);
  });

  it('a Part outside the envelope at rest, at the end, or by its extents is reported by name', () => {
    // Half-extents are 1.2, 0.6, 0.4 m. Extents 0.2 m give a half-size of 0.1 m.
    const restOut = checkEnvelope(catalogueOf([part({ id: 'r', restPosition: [1.2, 0, 0] })]));
    expect(restOut.some((f) => f.includes('"r"') && f.includes('rest position'))).toBe(true);
    const endOut = checkEnvelope(catalogueOf([part({ id: 'e', explodeVector: [1.3, 0, 0] })]));
    expect(endOut.some((f) => f.includes('"e"') && f.includes('end position'))).toBe(true);
    const wide = checkEnvelope(catalogueOf([part({ id: 'w', extents: [0.2, 0.2, 0.9] })]));
    expect(wide.some((f) => f.includes('"w"') && f.includes('on z'))).toBe(true);
    const inside = checkEnvelope(
      catalogueOf([part({ id: 'ok', restPosition: [-1, 0.4, 0.2], explodeVector: [1.5, 0, 0], extents: [0.2, 0.2, 0.2] })]),
    );
    expect(inside).toEqual([]);
  });

  it('a Part past the low side of the envelope at rest is reported', () => {
    // Extents 0.2 m: the box spans -1.3 to -1.1 on x, past the -1.2 m limit.
    const failures = checkEnvelope(
      catalogueOf([part({ id: 'lo', restPosition: [-1.2, 0, 0], extents: [0.2, 0.2, 0.2], explodeVector: [0.1, 0, 0] })]),
    );
    expect(failures.some((f) => f.includes('"lo"') && f.includes('rest position'))).toBe(true);
  });

  it('the end position uses the y and z parts of the explode vector', () => {
    const onZ = checkEnvelope(
      catalogueOf([part({ id: 'z', restPosition: [0, 0, 0.2], explodeVector: [0, 0, 0.5], extents: [0.2, 0.2, 0.2] })]),
    );
    expect(onZ.some((f) => f.includes('"z"') && f.includes('end position') && f.includes('on z'))).toBe(true);
    const onY = checkEnvelope(
      catalogueOf([part({ id: 'y', restPosition: [0, 0, 0], explodeVector: [0, 0.8, 0], extents: [0.2, 0.2, 0.2] })]),
    );
    expect(onY.some((f) => f.includes('"y"') && f.includes('end position') && f.includes('on y'))).toBe(true);
  });

  it('an extent of exactly 0 is reported', () => {
    const failures = checkFieldsPresent(catalogueOf([part({ id: 'flat', extents: [0, 0.2, 0.2] })]));
    expect(failures.some((f) => f.includes('"flat"') && f.includes('extents'))).toBe(true);
  });

  it('a Machine with no Parts is reported by name', () => {
    const cat: Catalogue = { machines: [{ id: 'pump', name: 'Pump', partIds: [] }], parts: [] };
    const failures = checkFieldsPresent(cat);
    expect(failures.some((f) => f.includes('Machine "pump"') && f.includes('has no Parts'))).toBe(true);
  });

  it('two Machines with the same id are reported by name', () => {
    const cat: Catalogue = {
      machines: [
        { id: 'pump', name: 'Pump one', partIds: ['a'] },
        { id: 'pump', name: 'Pump two', partIds: [] },
      ],
      parts: [part({ id: 'a' })],
    };
    const failures = checkUniqueIds(cat);
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain('Machine "pump"');
  });

  it('a keyboard order that lists an unknown Part id is reported by that id', () => {
    const failures = checkKeyboardOrder(catalogueOf([part({ id: 'a' })], ['a', 'ghost']));
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain('ghost');
  });

  it('an empty field or a bad vector is reported by name', () => {
    const emptyJob = checkFieldsPresent(catalogueOf([part({ id: 'a', job: '  ' })]));
    expect(emptyJob.length).toBe(1);
    expect(emptyJob[0]).toContain('"a"');
    expect(emptyJob[0]).toContain('job');
    const badVector = checkFieldsPresent(
      catalogueOf([part({ id: 'b', restPosition: [0, 0] as unknown as PartEntry['restPosition'] })]),
    );
    expect(badVector.length).toBe(1);
    expect(badVector[0]).toContain('"b"');
  });

  it('a missing, extra or repeated named Part is reported', () => {
    const cat = catalogueOf([
      part({ id: 'p1', name: 'Casing' }),
      part({ id: 'p2', name: 'Bolts (one group)' }),
      part({ id: 'p3', name: 'Gasket' }),
    ]);
    const failures = checkNamedParts(cat, 'pump', ['casing', 'bolts', 'motor']);
    expect(failures.length).toBe(2);
    expect(failures.some((f) => f.includes('"p3"'))).toBe(true);
    expect(failures.some((f) => f.includes('"motor"'))).toBe(true);
    const repeated = checkNamedParts(
      catalogueOf([part({ id: 'p1', name: 'Casing' }), part({ id: 'p2', name: 'casing' })]),
      'pump',
      ['casing'],
    );
    expect(repeated.length).toBe(1);
    expect(repeated[0]).toContain('"casing"');
  });
});
