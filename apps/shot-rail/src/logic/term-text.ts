// Term_Text: the one-line explanations shown on hover and keyboard focus (Requirement 17.10),
// the "commonly said" angle notes (Requirement 5.8) and the wording of the label cut-offs.
// Pure data and two small functions. Every line names the row (or rows) of docs/sources.md it rests on.
// A line with no source ids is this app's own definition of its own term, not a fact about the world.

import {
  ANGLE_HIGH_MIN_DEG,
  ANGLE_LOW_MAX_DEG,
  ANGLE_OVERHEAD_MIN_DEG,
  FILL_CLOSEUP_MIN_PERCENT,
  FILL_WIDE_MAX_PERCENT,
  SENSOR_HEIGHT_MM,
  SENSOR_WIDTH_MM,
} from './constants.js';
import type { AngleLabel, FramingLabel } from './labels.js';
import type { ShotType } from './shot-builders.js';

export interface TermLine {
  readonly text: string;
  /** Ids of the docs/sources.md rows this line rests on. Empty means the app's own definition. */
  readonly sourceIds: readonly string[];
}

/** The ids that exist in docs/sources.md. A line may only name one of these. */
export const TERM_SOURCE_IDS = [
  'camera-angle',
  'overhead',
  'shot-sizes',
  'camera-moves',
  'angle-of-view',
  'normal-lens',
  'thirds',
  'ebu-r95',
  'effects-bowen-thompson',
  'effects-reid-sanders',
  'effects-low-angle',
] as const;

const line = (text: string, ...sourceIds: string[]): TermLine => ({ text, sourceIds });

export const ANGLE_TERMS: Readonly<Record<AngleLabel, TermLine>> = {
  'low angle': line('The camera is below the subject and looks up at it.', 'camera-angle'),
  'eye level': line('The camera is about level with the subject and looks straight at it.', 'camera-angle'),
  'high angle': line('The camera is above the subject and looks down at it.', 'camera-angle'),
  overhead: line('The camera is far above the subject and looks steeply down. A true overhead is directly above.', 'overhead'),
};

export const FRAMING_TERMS: Readonly<Record<FramingLabel, TermLine>> = {
  'close-up': line('The subject fills most of the frame. For a person, about head and shoulders.', 'shot-sizes'),
  medium: line('The subject is a middle size in the frame. For a person, about waist up.', 'shot-sizes'),
  wide: line('The whole subject is in the frame and looks small. For a person, the full body fits in.', 'shot-sizes'),
};

export const SHOT_TYPE_TERMS: Readonly<Record<ShotType, TermLine>> = {
  'push-in': line('The camera moves straight toward the subject. Film crews also call this a dolly in.', 'camera-moves'),
  orbit: line('The camera circles the subject and keeps it in view. Film crews also call this an arc.', 'camera-moves'),
  tracking: line('The camera travels with the subject and stays at the same offset from it.', 'camera-moves'),
  crane: line('The camera rises through the air while it keeps the subject in view, like a shot from a crane arm.', 'camera-moves'),
};

export const LENS_TERMS: Readonly<Record<number, TermLine>> = {
  24: line('A short lens. It sees a wide slice of the scene.', 'angle-of-view', 'normal-lens'),
  35: line('A little shorter than a normal lens, so the view is a little wider.', 'angle-of-view', 'normal-lens'),
  50: line('Close to a normal lens for this frame. A middle view, neither wide nor tight.', 'angle-of-view', 'normal-lens'),
  85: line('A long lens. It sees a narrow slice of the scene, so the subject fills more of the frame.', 'angle-of-view', 'normal-lens'),
};

export const MEASURE_TERMS = {
  lens: line('Focal length in millimetres. A smaller number sees a wider view. A larger number sees a narrower view.', 'angle-of-view'),
  lensZoom: line('Zoom changes the lens only. The camera stays where it is and sees a narrower or wider slice of the scene.', 'angle-of-view'),
  fieldOfView: line('How much of the scene the lens sees, as an angle. Horizontal is side to side. Vertical is top to bottom.', 'angle-of-view'),
  fieldOfViewFormula: line(
    `Field of view = 2 x atan(sensor size / (2 x focal length)), using this app's ${SENSOR_WIDTH_MM} x ${SENSOR_HEIGHT_MM} mm frame.`,
    'angle-of-view',
  ),
  bearing: line('Where the camera stands in a circle around the subject, in degrees. 0 is the +Z side.'),
  height: line('How far the camera is above the subject centre, in metres. Below it is negative.'),
  horizontalDistance: line('How far the camera is from the subject, measured sideways only. Height is ignored.'),
  straightLineDistance: line('The direct distance from the camera to the subject centre. Height is included.'),
  elevation: line('How far above or below the subject the camera sits, as an angle. 0 is level.'),
  fill: line('How much of the frame the subject takes up: its larger share of width or of height.'),
  thirdsGuide: line('Lines that split the frame into nine equal parts. A common aid is to put the subject on a line or where two cross.', 'thirds'),
  safeAreaGuide: line('The outline of the EBU action safe area, 3.5% in from each edge of the frame.', 'ebu-r95'),
} as const;

/** "Commonly said" notes. Overhead has none: no usable source was found, so no note is shown. */
export const ANGLE_NOTES: Readonly<Partial<Record<AngleLabel, TermLine>>> = {
  'low angle': line('Commonly said: a low angle can make the subject look powerful.', 'effects-low-angle'),
  'eye level': line('Commonly said: eye level looks neutral.', 'effects-reid-sanders'),
  'high angle': line('Commonly said: a high angle often makes the subject look small or weak.', 'effects-bowen-thompson', 'effects-reid-sanders'),
};

/** Shown beside the cut-offs. The film sources describe angles and shot sizes in words, not in degrees or percent. */
export const CUTOFF_NOTE =
  "These cut-offs are this app's own. The film guides checked describe angles and shot sizes in words and give no degrees or percentages.";

export function angleCutoffText(label: AngleLabel): string {
  switch (label) {
    case 'low angle':
      return `below ${ANGLE_LOW_MAX_DEG}°`;
    case 'eye level':
      return `${ANGLE_LOW_MAX_DEG}° to ${ANGLE_HIGH_MIN_DEG}°`;
    case 'high angle':
      return `above ${ANGLE_HIGH_MIN_DEG}° up to ${ANGLE_OVERHEAD_MIN_DEG}°`;
    case 'overhead':
      return `above ${ANGLE_OVERHEAD_MIN_DEG}°`;
  }
}

export function framingCutoffText(label: FramingLabel): string {
  switch (label) {
    case 'close-up':
      return `above ${FILL_CLOSEUP_MIN_PERCENT}% fill`;
    case 'medium':
      return `${FILL_WIDE_MAX_PERCENT}% to ${FILL_CLOSEUP_MIN_PERCENT}% fill`;
    case 'wide':
      return `below ${FILL_WIDE_MAX_PERCENT}% fill`;
  }
}
