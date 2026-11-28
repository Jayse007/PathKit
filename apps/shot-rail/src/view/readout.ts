// Readout (task 38.1): the right-hand column. It shows, for the main camera at the displayed frame, the
// Angle_Label, the elevation behind it, the Framing_Label, the fill behind it, the horizontal and vertical
// field of view, and the horizontal and straight-line distance to the subject. Everything is read-only text.
//
// It touches the DOM, so no test imports this file. The numbers and labels come from shot-measures.ts, the
// same calculation the Coverage_Grid tile captions use, so the two always agree. Formatting and wording
// helpers are in readout-rules.ts (pure). Every explanation, cut-off text and "commonly said" note is read
// from ../logic/term-text.ts and is not rewritten here.
//
// Findings of the motion check are not shown here: the Timeline marks them (task 34.1) and the motion check
// list (task 39) will list them.
//
// Per frame: show() makes no objects, arrays or closures. Each number is rounded to its shown decimals and
// the text is built and assigned only when that rounded number changed. The field of view is computed only
// when the lens changed. Labels, their hover lines, cut-offs and the note are written only when the label
// changed (a rare event, so those few strings may be created then).
//
// No aria-live: the values change up to 30 times a second while playing, and a live region would announce
// each change. Each value is focusable (Tab) so keyboard users get its explanation in the hint line.

import { fieldOfViewForFocalLengthMm } from '../logic/lens.js';
import type { OutBuffer } from '../logic/pathkit.js';
import {
  ANGLE_NOTES,
  ANGLE_TERMS,
  CUTOFF_NOTE,
  FRAMING_TERMS,
  MEASURE_TERMS,
  angleCutoffText,
  framingCutoffText,
} from '../logic/term-text.js';
import type { CameraRig } from './camera-rig.js';
import { setRegionEmpty } from './layout.js';
import {
  DISTANCE_DECIMALS,
  ELEVATION_DECIMALS,
  FIELD_OF_VIEW_DECIMALS,
  FIELD_OF_VIEW_TITLE,
  FILL_DECIMALS,
  READOUT_LABELS,
  cutoffLine,
  degreesText,
  metresText,
  percentText,
  sourceLine,
  valueKey,
} from './readout-rules.js';
import { createShotMeasures, measureShot } from './shot-measures.js';

// View-only values (not in the design's Named constants table).
const EMPTY_REGION_ID = 'readout-empty';
const RAD_TO_DEG = 180 / Math.PI;
const NO_KEY = Number.NaN; // never equal to a real key, so the first show writes every value
const NO_TEXT = '';
const ROW_GAP_PX = 8;
const CUTOFF_GAP_PX = 8;
const MUTED_COLOUR = 'var(--text-muted)';

export interface Readout {
  /**
   * Show the main camera `cameraId` with lens `lensMm` at `displayedFrame`. Call it on every change of the
   * displayed frame, the lens, the main camera and after a re-bake. `displayedFrame` must be inside the
   * baked shot (the rig throws otherwise). Never bakes. No allocation while the labels and lens are unchanged.
   */
  show(rig: CameraRig, cameraId: string, lensMm: number, displayedFrame: number): void;
}

interface Row {
  /** The element that carries the hover line (its `title`). */
  readonly row: HTMLElement;
  /** The value text. Focusable, so the hint line shows the row's line on keyboard focus. */
  readonly value: HTMLElement;
}

/**
 * Builds the Readout inside `container` (the readout column) and hides its empty-region message.
 * Returns null when `container` is null.
 */
export function createReadout(container: HTMLElement | null): Readout | null {
  if (container === null) return null;

  const list = document.createElement('dl');
  list.style.margin = '0';

  // A row is `dt` (plain label) and `dd` (value, with an optional cut-off beside it), inside one div that
  // carries the title. The div is the nearest titled ancestor of the focused value.
  const makeRow = (label: string, title: string, cutoff: HTMLElement | null): Row => {
    const row = document.createElement('div');
    row.title = title;
    row.style.marginBottom = `${ROW_GAP_PX}px`;
    const term = document.createElement('dt');
    term.textContent = label;
    term.style.color = MUTED_COLOUR;
    const value = document.createElement('dd');
    value.style.margin = '0';
    value.tabIndex = 0;
    const valueText = document.createElement('span');
    value.append(valueText);
    if (cutoff !== null) {
      cutoff.style.color = MUTED_COLOUR;
      cutoff.style.marginLeft = `${CUTOFF_GAP_PX}px`;
      value.append(cutoff);
    }
    row.append(term, value);
    list.append(row);
    return { row, value: valueText };
  };

  const angleCutoff = document.createElement('span');
  const framingCutoff = document.createElement('span');
  const angleRow = makeRow(READOUT_LABELS.angle, NO_TEXT, angleCutoff);
  const elevationRow = makeRow(READOUT_LABELS.elevation, MEASURE_TERMS.elevation.text, null);
  const framingRow = makeRow(READOUT_LABELS.framing, NO_TEXT, framingCutoff);
  const fillRow = makeRow(READOUT_LABELS.fill, MEASURE_TERMS.fill.text, null);
  const horizontalFovRow = makeRow(READOUT_LABELS.horizontalFieldOfView, FIELD_OF_VIEW_TITLE, null);
  const verticalFovRow = makeRow(READOUT_LABELS.verticalFieldOfView, FIELD_OF_VIEW_TITLE, null);
  const horizontalDistanceRow = makeRow(
    READOUT_LABELS.horizontalDistance,
    MEASURE_TERMS.horizontalDistance.text,
    null,
  );
  const straightLineDistanceRow = makeRow(
    READOUT_LABELS.straightLineDistance,
    MEASURE_TERMS.straightLineDistance.text,
    null,
  );

  // The "commonly said" note for the current angle. Hidden when the angle has none (overhead).
  const noteBox = document.createElement('p');
  noteBox.hidden = true;
  noteBox.style.margin = `0 0 ${ROW_GAP_PX}px`;
  const noteText = document.createElement('span');
  const noteSource = document.createElement('span');
  noteSource.style.display = 'block';
  noteSource.style.color = MUTED_COLOUR;
  noteBox.append(noteText, noteSource);

  const cutoffNote = document.createElement('p');
  cutoffNote.textContent = CUTOFF_NOTE;
  cutoffNote.style.margin = '0';
  cutoffNote.style.color = MUTED_COLOUR;

  container.append(list, noteBox, cutoffNote);
  setRegionEmpty(EMPTY_REGION_ID, false);

  // Scratch and last-shown state, made once.
  const camOut: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const subjectOut: OutBuffer = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
  const measures = createShotMeasures();
  let lastLensMm = NO_KEY;
  let verticalFovRad = 0;
  let lastAngle = NO_TEXT;
  let lastFraming = NO_TEXT;
  let lastElevationKey = NO_KEY;
  let lastFillKey = NO_KEY;
  let lastHorizontalKey = NO_KEY;
  let lastStraightKey = NO_KEY;

  return {
    show(rig: CameraRig, cameraId: string, lensMm: number, displayedFrame: number): void {
      if (lensMm !== lastLensMm) {
        // Lens changes only: the object this makes is not a per-frame cost.
        const fov = fieldOfViewForFocalLengthMm(lensMm); // throws for a bad lens, before anything changes
        verticalFovRad = fov.verticalDeg / RAD_TO_DEG;
        horizontalFovRow.value.textContent = degreesText(
          valueKey(fov.horizontalDeg, FIELD_OF_VIEW_DECIMALS),
          FIELD_OF_VIEW_DECIMALS,
        );
        verticalFovRow.value.textContent = degreesText(
          valueKey(fov.verticalDeg, FIELD_OF_VIEW_DECIMALS),
          FIELD_OF_VIEW_DECIMALS,
        );
        lastLensMm = lensMm;
      }

      rig.evaluate(cameraId, displayedFrame, camOut);
      rig.evaluateSubject(displayedFrame, subjectOut);
      measureShot(camOut, subjectOut, verticalFovRad, measures);

      const angle = measures.angle;
      if (angle !== lastAngle) {
        angleRow.value.textContent = angle;
        angleCutoff.textContent = cutoffLine(angleCutoffText(angle));
        angleRow.row.title = ANGLE_TERMS[angle].text;
        const note = ANGLE_NOTES[angle];
        if (note === undefined) {
          noteText.textContent = NO_TEXT;
          noteSource.textContent = NO_TEXT;
          noteBox.hidden = true;
        } else {
          noteText.textContent = note.text;
          noteSource.textContent = sourceLine(note);
          noteBox.hidden = false;
        }
        lastAngle = angle;
      }

      const framing = measures.framing;
      if (framing !== lastFraming) {
        framingRow.value.textContent = framing;
        framingCutoff.textContent = cutoffLine(framingCutoffText(framing));
        framingRow.row.title = FRAMING_TERMS[framing].text;
        lastFraming = framing;
      }

      const elevationKey = valueKey(measures.elevationDeg, ELEVATION_DECIMALS);
      if (elevationKey !== lastElevationKey) {
        elevationRow.value.textContent = degreesText(elevationKey, ELEVATION_DECIMALS);
        lastElevationKey = elevationKey;
      }
      const fillKey = valueKey(measures.fillPercent, FILL_DECIMALS);
      if (fillKey !== lastFillKey) {
        fillRow.value.textContent = percentText(fillKey, FILL_DECIMALS);
        lastFillKey = fillKey;
      }
      const horizontalKey = valueKey(measures.horizontalDistanceM, DISTANCE_DECIMALS);
      if (horizontalKey !== lastHorizontalKey) {
        horizontalDistanceRow.value.textContent = metresText(horizontalKey, DISTANCE_DECIMALS);
        lastHorizontalKey = horizontalKey;
      }
      const straightKey = valueKey(measures.straightLineDistanceM, DISTANCE_DECIMALS);
      if (straightKey !== lastStraightKey) {
        straightLineDistanceRow.value.textContent = metresText(straightKey, DISTANCE_DECIMALS);
        lastStraightKey = straightKey;
      }
    },
  };
}
