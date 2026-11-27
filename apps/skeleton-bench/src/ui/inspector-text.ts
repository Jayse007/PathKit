// Pure text for the Inspector and the Parts_List (Task 20.2). No DOM here, so it is unit tested.
import type { Catalogue, MachineId, PartEntry, Vec3 } from '../data/catalogue-types.js';

/** Requirement 14.5: shown while no Part is selected. */
export const EMPTY_INSPECTOR_TEXT = 'Pick a part to read about it';

/** Requirement 14.4: the label on every invented specification value. */
export const SAMPLE_DATA_LABEL = 'sample data';

export interface SampleSpec {
  readonly label: string;
  readonly value: string;
}

export interface InspectorPartContent {
  readonly kind: 'part';
  readonly name: string;
  readonly job: string;
  readonly material: string;
  readonly positionText: string;
  readonly sampleSpecs: readonly SampleSpec[];
}

export interface InspectorEmptyContent {
  readonly kind: 'empty';
  readonly message: string;
}

export type InspectorContent = InspectorPartContent | InspectorEmptyContent;

/** Whole millimetres from metres. */
function mm(metres: number): number {
  return Math.round(metres * 1000);
}

/** "500 x 400 x 400 mm" for a Part's full box (x length, y height, z depth), rounded to whole millimetres. */
export function modelSizeText(extents: Vec3): string {
  return `${mm(extents[0])} x ${mm(extents[1])} x ${mm(extents[2])} mm`;
}

/**
 * What the Inspector shows. A Part gives its name, job, material and position text from the
 * catalogue, plus the sample specifications. The only sample value is the size of the drawn model
 * (taken from the catalogue extents), which is the project's own number and needs no source.
 */
export function inspectorContent(part: PartEntry | null): InspectorContent {
  if (part === null) return { kind: 'empty', message: EMPTY_INSPECTOR_TEXT };
  return {
    kind: 'part',
    name: part.name,
    job: part.job,
    material: part.material,
    positionText: part.positionText,
    sampleSpecs: [{ label: 'Model size (length x height x depth)', value: modelSizeText(part.extents) }],
  };
}

/** The Parts of one Machine in Part_Catalogue order (Requirement 14.8). Unknown Machine gives an empty list. */
export function machineParts(catalogue: Catalogue, machine: MachineId): PartEntry[] {
  const entry = catalogue.machines.find((m) => m.id === machine);
  if (entry === undefined) return [];
  return catalogue.parts.filter((p) => entry.partIds.includes(p.id));
}

/** The Part with this id, or null for null, an unknown id, or an id from another Machine. */
export function findMachinePart(catalogue: Catalogue, machine: MachineId, partId: string | null): PartEntry | null {
  if (partId === null) return null;
  return machineParts(catalogue, machine).find((p) => p.id === partId) ?? null;
}

/** The selection after the User activates the button of `clicked`: the same Part again closes it (null), any other Part opens. */
export function togglePartSelection(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}

/** The selection after a click on the Stage that picked `pickedId` (null = empty space). Empty space clears. Clicking the selected Part keeps it. */
export function selectionAfterStageClick(current: string | null, pickedId: string | null): string | null {
  return pickedId;
}
