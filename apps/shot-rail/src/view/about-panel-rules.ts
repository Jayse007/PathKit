// About_Panel rules (task 42.1): the whole About text as named constants, in one place, so a test can check
// it (task 42.2) and the User can read and approve it in one place (task 42.3). Pure data. No DOM, no
// storage, no clock, so a test may import this file. about-panel.ts does the DOM work.
//
// Where each line comes from (the same list is in docs/build-notes.md, task 42.1):
// - the six limit statements follow Requirements 21.1 to 21.5 and 21.8 (tasks.md 42.1), with "the Subject"
//   written as "the car" because the car is the only Subject (User decision, 28 November 2026);
// - the label note is CUTOFF_NOTE from term-text.ts, reused as it stands;
// - the sources line and the third-party list come from THIRD_PARTY.md;
// - every line marked DRAFT is plain wording for the User to approve at task 42.3.

import { SENSOR_WIDTH_MM } from '../logic/constants.js';
import { CUTOFF_NOTE } from '../logic/term-text.js';

/** One block of the About text. `list` shows the lines as a bulleted list, `paragraphs` as paragraphs. */
export interface AboutSection {
  readonly id: string;
  readonly heading: string;
  readonly kind: 'paragraphs' | 'list';
  /** A paragraph shown above a list. Empty string for none. */
  readonly intro: string;
  readonly lines: readonly string[];
}

// ---- Panel furniture (DRAFT) ----
export const ABOUT_TITLE = 'About Shot Rail';
export const ABOUT_BUTTON_LABEL = 'About';
/** Tooltip of the About button. layout.ts also shows it in the hint line when the button has keyboard focus. */
export const ABOUT_BUTTON_TOOLTIP = 'About this app: what it does not show, and where its facts come from. Key: ?';
export const ABOUT_CLOSE_LABEL = 'Close';

// ---- The six limit statements (Requirements 21.1 to 21.5 and 21.8) ----
/** 21.1, with "the Subject" written as "the car". */
export const ABOUT_SUBJECT_TEXT =
  'The car is a stand-in drawn from shapes. There is no lighting, exposure or depth-of-field simulation.';
/** 21.2. The clause "unless Spike S3 shows otherwise" does not apply: S3 found nothing that changes it. */
export const ABOUT_ANGLES_TEXT =
  "Angles are measured from the world axes and not from the car's heading, so a turning car changes its relation to a fixed-bearing camera.";
/**
 * 21.3. First sentence from the requirement. The recorded outcome of spike S6 is Outcome A (build-notes, task 11.2),
 * so the main camera has no scene of its own. The last two sentences are DRAFT; they follow scene-set.ts and main.ts.
 */
export const ABOUT_SCENES_TEXT =
  'PathKit allows one path per scene, so the car and the cameras are baked in separate scenes. ' +
  'All the cameras share one scene, because a check made while building this app found that one scene gives the same values as separate scenes. ' +
  "That scene has one path, the main camera's rail, so only the main camera can be a push-in or crane shot.";
/** 21.4. The frame used is 36 mm wide and 16:9. */
export const ABOUT_LENS_TEXT = `The lens maths assumes a sensor ${SENSOR_WIDTH_MM} mm wide. Another sensor changes the angles.`;
/** 21.5. */
export const ABOUT_PLANNING_TEXT = 'This app is rough planning. It is not a prediction of real footage.';
/** 21.8. */
export const ABOUT_RAIL_TEXT =
  'Rail cameras (push-in and crane) move along a fixed rail, do not follow the car, and only aim at it.';

/** The six statements in the order of the requirements. */
export const ABOUT_LIMIT_LINES: readonly string[] = [
  ABOUT_SUBJECT_TEXT,
  ABOUT_ANGLES_TEXT,
  ABOUT_SCENES_TEXT,
  ABOUT_LENS_TEXT,
  ABOUT_PLANNING_TEXT,
  ABOUT_RAIL_TEXT,
];

// ---- Labels, sources, third-party software, keys ----
/** The label cut-offs note, reused from term-text.ts so the two places cannot disagree. */
export const ABOUT_LABELS_TEXT = CUTOFF_NOTE;
/** From THIRD_PARTY.md, "Facts and sources". The file name is given in plain words. */
export const ABOUT_SOURCES_TEXT =
  'The explanation texts paraphrase the pages listed in docs/sources.md. No text, image, font or data from those pages is copied into the app.';
/** DRAFT. */
export const ABOUT_THIRD_PARTY_INTRO = 'Shot Rail uses these packages. PathKit, the motion library, is part of this project.';

export interface ThirdPartyRow {
  readonly name: string;
  readonly version: string;
  readonly licence: string;
  /** DRAFT: what the package is used for. */
  readonly use: string;
}

/** Name, version and licence from THIRD_PARTY.md (versions as pinned in package.json). */
export const THIRD_PARTY_ROWS: readonly ThirdPartyRow[] = [
  { name: 'three', version: '0.187.0', licence: 'MIT', use: 'draws the 3D views' },
  { name: '@types/three', version: '0.187.0', licence: 'MIT', use: 'type definitions for three (build time only)' },
  { name: 'Vite', version: '7.3.8', licence: 'MIT', use: 'builds the app (build time only)' },
  { name: 'Vitest', version: '3.2.7', licence: 'MIT', use: 'runs the tests (build time only)' },
  { name: 'TypeScript', version: '5.9.3', licence: 'Apache-2.0', use: 'checks and compiles the code (build time only)' },
];

/** One line per third-party package, for the list. */
export function thirdPartyLine(row: ThirdPartyRow): string {
  return `${row.name} ${row.version}, ${row.licence} licence: ${row.use}.`;
}

/** DRAFT. The keys are those of key-map.ts ('?') and the dialog's Escape. */
export const ABOUT_KEYS_TEXT = 'Press ? to open this panel. Press Escape to close it.';

export const ABOUT_THIRD_PARTY_LINES: readonly string[] = THIRD_PARTY_ROWS.map(thirdPartyLine);

// ---- Headings (DRAFT) ----
export const ABOUT_LIMITS_HEADING = 'What this app does not do';
export const ABOUT_LABELS_HEADING = 'Labels';
export const ABOUT_SOURCES_HEADING = 'Facts and sources';
export const ABOUT_THIRD_PARTY_HEADING = 'Third-party software';
export const ABOUT_KEYS_HEADING = 'Keys';

/** The sections in the order they are shown. */
export const ABOUT_SECTIONS: readonly AboutSection[] = [
  { id: 'about-limits', heading: ABOUT_LIMITS_HEADING, kind: 'list', intro: '', lines: ABOUT_LIMIT_LINES },
  { id: 'about-labels', heading: ABOUT_LABELS_HEADING, kind: 'paragraphs', intro: '', lines: [ABOUT_LABELS_TEXT] },
  { id: 'about-sources', heading: ABOUT_SOURCES_HEADING, kind: 'paragraphs', intro: '', lines: [ABOUT_SOURCES_TEXT] },
  {
    id: 'about-third-party',
    heading: ABOUT_THIRD_PARTY_HEADING,
    kind: 'list',
    intro: ABOUT_THIRD_PARTY_INTRO,
    lines: ABOUT_THIRD_PARTY_LINES,
  },
  { id: 'about-keys', heading: ABOUT_KEYS_HEADING, kind: 'paragraphs', intro: '', lines: [ABOUT_KEYS_TEXT] },
];

/** Every line of the panel (title, headings and text) joined with newlines, for one-place checks. */
export function aboutFullText(): string {
  const parts: string[] = [ABOUT_TITLE];
  for (const section of ABOUT_SECTIONS) {
    parts.push(section.heading);
    if (section.intro !== '') parts.push(section.intro);
    parts.push(...section.lines);
  }
  return parts.join('\n');
}
