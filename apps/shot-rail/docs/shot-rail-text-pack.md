# Shot Rail text pack (hover texts, "commonly said" notes, cut-off wording)

Written 2026-11-27. Save as `apps/shot-rail/docs/shot-rail-text-pack.md`.

## 1. What this does and when to run it

- Adds one new data file with every one-line hover text (Requirement 17.10), the "commonly said" angle notes (Requirement 5.8) and the cut-off wording, so Task 38.1 can build the readout from it.
- Replaces the claim that the cut-offs are "commonly used". No source supports it (section 6). The app now says they are this app's own.
- Run it after the current checkpoint (30.2). It touches no existing source file, so it can be done at any time before Task 38.1.
- Adds 1 test file and 11 tests to whatever the Shot Rail count is when you run it. At today's count (27 files, 252 passed) it becomes 28 files, 263 passed.

## 2. New file `apps/shot-rail/src/logic/term-text.ts` (copy exactly)

```ts
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
```

## 3. New file `apps/shot-rail/test/logic/term-text.test.ts` (copy exactly)

```ts
import { describe, expect, it } from 'vitest';
import { LENS_PRESETS_MM } from '../../src/logic/constants.js';
import {
  ANGLE_NOTES,
  ANGLE_TERMS,
  CUTOFF_NOTE,
  FRAMING_TERMS,
  LENS_TERMS,
  MEASURE_TERMS,
  SHOT_TYPE_TERMS,
  TERM_SOURCE_IDS,
  angleCutoffText,
  framingCutoffText,
  type TermLine,
} from '../../src/logic/term-text.js';

const everyLine: Array<[string, TermLine]> = [
  ...Object.entries(ANGLE_TERMS),
  ...Object.entries(FRAMING_TERMS),
  ...Object.entries(SHOT_TYPE_TERMS),
  ...Object.entries(LENS_TERMS),
  ...Object.entries(MEASURE_TERMS),
  ...Object.entries(ANGLE_NOTES),
] as Array<[string, TermLine]>;

describe('term text lines', () => {
  it('has 4 + 3 + 4 + 4 + 11 + 3 = 29 lines', () => {
    expect(everyLine).toHaveLength(29);
  });

  it('keeps every line to one short line of text', () => {
    for (const [key, l] of everyLine) {
      expect(l.text, key).not.toMatch(/[\r\n]/);
      expect(l.text.trim(), key).toBe(l.text);
      expect(l.text.length, key).toBeGreaterThan(10);
      expect(l.text.length, key).toBeLessThanOrEqual(140);
    }
  });

  it('names only source ids that docs/sources.md is meant to hold', () => {
    for (const [key, l] of everyLine) {
      for (const id of l.sourceIds) expect(TERM_SOURCE_IDS, `${key}: ${id}`).toContain(id);
    }
  });

  it('gives every lens preset a line, and no other lens', () => {
    expect(Object.keys(LENS_TERMS).map(Number).sort((a, b) => a - b)).toEqual([...LENS_PRESETS_MM]);
  });
});

describe('commonly said notes', () => {
  it('has notes for low angle, eye level and high angle only', () => {
    expect(Object.keys(ANGLE_NOTES).sort()).toEqual(['eye level', 'high angle', 'low angle']);
  });

  it('marks each note "Commonly said:" and gives each at least one source', () => {
    for (const [key, l] of Object.entries(ANGLE_NOTES) as Array<[string, TermLine]>) {
      expect(l.text, key).toMatch(/^Commonly said: /);
      expect(l.sourceIds.length, key).toBeGreaterThan(0);
    }
  });

  it('does not state an effect in the plain angle explanations', () => {
    for (const [key, l] of Object.entries(ANGLE_TERMS) as Array<[string, TermLine]>) {
      expect(l.text, key).not.toMatch(/power|weak|small|strong|vulnerab|dominan/i);
    }
  });
});

describe('cut-off wording', () => {
  // Hand-written. The numbers come from the spec (-10, 10, 60 degrees; 35 and 70 percent), not from the constants.
  it('writes the angle cut-offs', () => {
    expect(angleCutoffText('low angle')).toBe('below -10°');
    expect(angleCutoffText('eye level')).toBe('-10° to 10°');
    expect(angleCutoffText('high angle')).toBe('above 10° up to 60°');
    expect(angleCutoffText('overhead')).toBe('above 60°');
  });

  it('writes the framing cut-offs', () => {
    expect(framingCutoffText('close-up')).toBe('above 70% fill');
    expect(framingCutoffText('medium')).toBe('35% to 70% fill');
    expect(framingCutoffText('wide')).toBe('below 35% fill');
  });

  it('calls the cut-offs the app\'s own and never "commonly used"', () => {
    expect(CUTOFF_NOTE).toContain("this app's own");
    expect(CUTOFF_NOTE).not.toMatch(/commonly used/i);
  });
});

describe('field of view formula line', () => {
  it('states the sensor size the app really uses', () => {
    expect(MEASURE_TERMS.fieldOfViewFormula.text).toContain('36 x 20.25 mm');
  });
});
```

## 4. Replace the table in `apps/shot-rail/docs/sources.md`

Keep the first line and the sentence under it. Replace the whole table with this one (the EBU row is the existing row with an Id added). Each page was read on 2026-11-27. Content is paraphrased, with short quotes. "(weaker)" marks encyclopedias, blogs and one-maker pages.

| Id | Claim | Source | Date checked |
| --- | --- | --- | --- |
| ebu-r95 | The guide outlines the Action Safe area, 1 - 2 x 0.035 = 0.93 of each side. Quote, Note 5: "The action safe area is 3.5% and the graphics safe area is 5%, at the top, bottom and lateral parts of the image." The 5% graphics safe figure is in the same document and is not used. | EBU R 95, "Safe areas for 16:9 television production", version 1.1, June 2017, https://tech.ebu.ch/docs/r/r095.pdf | 2026-11-26 |
| camera-angle | Low angle: the camera is placed below eye level, so the viewer looks up at the subject. High angle: the camera is above eye level, so the viewer looks down. Eye level: in general the camera is about at eye level (page: "approximately at eye level, or up to six feet off the ground"). The page describes where the camera is only. It gives no effects and no degrees. Bordwell and Thompson define the angle of framing as the position of the frame in relation to the subject: above, looking down (a high angle), or looking up (a low angle); a "straight-on angle" is horizontal, on the same level. | Columbia University CCNMTL, Film Language Glossary, "Camera Angle", https://filmglossary.ccnmtl.columbia.edu/term/camera-angle ; Bordwell and Thompson, Film Art: An Introduction, 7th ed. (McGraw-Hill, 2004), glossary excerpt, https://core.humanities.uci.edu/archive/Student/WritersHandbook/Bordwell-Thompson-film-terms.pdf | 2026-11-27 |
| overhead | (weaker) An overhead shot is the camera placed directly above the subject, "somewhere around a 90-degree angle"; also called bird's eye view. The app calls anything above 60 degrees overhead, so the text says a true overhead is directly above. The page makes mixed claims about its effects, so no overhead effect note is shown. | StudioBinder, "The Overhead Shot", SC Lannom, 2023-02-26, https://www.studiobinder.com/blog/overhead-shot-bird-eye-view/ | 2026-11-27 |
| shot-sizes | Wide (long or full) shot: the full body of the person is in the frame, with less around them. Medium shot: from the waist to the top of the head. Close-up: from the tops of the shoulders to the top of the head. Bordwell and Thompson: a close-up shows the object at a relatively large scale (most commonly a head), a medium shot at a moderate scale, a long shot at a small scale. Neither source gives percentages of the frame. | Christopher Clemens, "8.1: Basic Shot Sizes", Video Production Handbook, Humanities LibreTexts (CC BY-NC 4.0), https://human.libretexts.org/Bookshelves/Theater%2C_Film%2C_and_Storytelling/Video_Production_Handbook/08%3A_Video_Aesthetics/8.01%3A_Basic_Shot_Sizes ; Bordwell and Thompson (as above) | 2026-11-27 |
| camera-moves | Dolly: the camera is moved closer to or further from the subject; sometimes called a push in and pull out (LibreTexts). Arc: moves around a subject in a circle (LibreTexts). The word "orbit" is not defined in the sources, so the text says "also call this an arc". Tracking: a mobile framing that travels forward, backward or laterally (Bordwell and Thompson); the camera follows the movement of the subject (LibreTexts). Crane shot: the camera is above the ground and moves through the air in any direction (Bordwell and Thompson); "dolly-shots-in-the-air" (Berkeley, weaker, no publisher named). Note: the Berkeley page defines a dolly as following the subject at a constant distance, which differs from LibreTexts; the app text uses the LibreTexts meaning for push-in. | Clemens, "9.3: Camera Movements", Documentary Culture, Humanities LibreTexts (CC BY-NC 4.0), https://human.libretexts.org/Bookshelves/Theater_Film_and_Storytelling/Documentary_Culture/09:_Video_Aesthetics/9.03:_Camera_Movements ; Bordwell and Thompson (as above) ; "Camera Movement Terms", https://casn.berkeley.edu/wp-content/uploads/resource_files/CameraMovementterms.pdf | 2026-11-27 |
| angle-of-view | Angle of view = 2 x arctan(d / 2f), where d is the length of the imaging area in the direction measured and f is the focal length (equation 6.1). The formula assumes a rectilinear lens (no distortion) focused at infinity. The 35 mm format is 36 x 24 mm. By the formula, a larger focal length gives a smaller angle. The app uses a 36 x 20.25 mm (16:9) frame, which is the app's own choice. | f/Calc manual, "Chapter 6. Angles of View", https://tangentsoft.com/fcalc/manual/aov.html ; Wikipedia, "Angle of view (photography)" (weaker), https://en.wikipedia.org/wiki/Angle_of_view_(photography) | 2026-11-27 |
| normal-lens | (weaker, encyclopedia) A lens whose focal length is about equal to the diagonal of the film or sensor format is considered normal. For 35 mm (diagonal 43 mm) the most commonly used normal lens is 50 mm, and about 40 to 58 mm are also considered normal. Shorter lenses are wide-angle. Longer lenses are long-focus, most commonly telephoto. The page also says cinematography often treats a wider lens as normal. The app frame diagonal is sqrt(36^2 + 20.25^2) = 41.3 mm (calculation), so 50 mm sits inside the 40 to 58 mm range and 35 mm just below it. The text says "normal lens for this frame" for that reason. | Wikipedia, "Normal lens", https://en.wikipedia.org/wiki/Normal_lens | 2026-11-27 |
| thirds | (weaker) The frame is divided into nine equal parts by two vertical and two horizontal lines; subjects are placed in line with these lines or at the intersections of the grid. | Canon Australia, glossary, "Rules of third", https://www.canon.com.au/explore/glossary/rule-of-thirds | 2026-11-27 |
| effects-bowen-thompson | High angle: covering a person from a higher vantage point "often yields an understanding" that the subject is smaller, weaker or subservient; foreshortening makes the subject appear shorter or smaller. Read from a publisher preview that stops mid-passage, so the full text may add qualifications. | Christopher J. Bowen and Roy Thompson, Grammar of the Shot, 2nd ed. (Focal Press, 2012), ISBN 9780240521213, https://www.oreilly.com/library/view/grammar-of-the/9780240521213/Chapter02i.html | 2026-11-27 |
| effects-reid-sanders | Eye level: placing the camera perpendicular to the subject "will create a neutral image perspective". High angle: "high-angle shots convey vulnerability". Low angle: the audience perceives the subject from a "diminutive perspective" (the viewer looks up). The text states these without hedging, so the app wording adds "commonly said" and "can" or "often". | Darren R. Reid and Brett Sanders, "The Visual Language of Cinema", chapter 12 (CC BY-NC 4.0), https://books.openbookpublishers.com/10.11647/obp.0255/ch12.xhtml | 2026-11-27 |
| effects-low-angle | (weaker) A low angle "makes the subject look strong and powerful" (Wikipedia, stated without hedging). "Subjects appear powerful" (Perkins, an open educational text with layout help from NotebookLM, stated without hedging). The app says "can" to hedge. | Wikipedia, "Low-angle shot", https://en.wikipedia.org/wiki/Low-angle_shot ; Tamara Perkins, "Camera Angles: Height and Angle as Argument", https://pressbooks.pub/app/uploads/sites/27491/2026/07/Camera_Angles_as_Visual_Argument_Transcript.pdf | 2026-11-27 |

## 5. Spec edits (four lines, wording only)

1. `.kiro/specs/shot-rail/requirements.md`, Requirement 5, criterion 6, and Requirement 6, criterion 5 (the same sentence, two places). Old: `describe the thresholds as "commonly used".` New: `describe the thresholds as this app's own cut-offs, in the wording of the Term_Text module.`
2. `.kiro/specs/shot-rail/tasks.md`, Task 38.1. Old: `described as "commonly used"`. New: `described as this app's own cut-offs (wording and hover lines from src/logic/term-text.ts)`.
3. `.kiro/specs/shot-rail/brief.md`, line 103. Old: `described as "commonly used".` New: `described as this app's own cut-offs.`
4. Requirement 5.8 and Task 38.2 stay as they are. The three notes in section 7 are what you approve at 38.2.

## 6. Why "commonly used" had to go

- Every film source read describes angles by where the camera sits (below, level with, above the subject) and shot sizes by how much of a person is in the frame (shoulders up, waist up, full body). None gives degrees or percent of the frame.
- So -10, 10 and 60 degrees and 35 and 70 percent are this app's own cut-offs. They are reasonable, and they are the app's choice. Calling them "commonly used" would state something no source says.
- The cut-offs stay as they are in `constants.ts`. Only the wording changes.

## 7. What you approve at Task 38.2

Three notes are allowed to appear. Each reads "Commonly said: ..." and has its sources in section 4.

| Angle | Note shown | Source strength |
| --- | --- | --- |
| low angle | Commonly said: a low angle can make the subject look powerful. | weaker only (Wikipedia, an open educational text). Reject it if you want strong sources only. |
| eye level | Commonly said: eye level looks neutral. | one open textbook (Reid and Sanders, 2021) |
| high angle | Commonly said: a high angle often makes the subject look small or weak. | a Focal Press textbook (Bowen and Thompson, 2012) plus Reid and Sanders |

- Overhead has no note. The only source found makes mixed claims, so no note is shown.
- If you reject a note, delete its line in `ANGLE_NOTES` and its test expectation. The sources row can stay.

## 8. Lines to add to `apps/shot-rail/THIRD_PARTY.md`

Add a short section: "Facts and sources. The explanation texts paraphrase the pages listed in `docs/sources.md`. No text, image, font or data from those pages is copied into the app." The Reid and Sanders chapter, the two LibreTexts pages and the Perkins text are CC BY-NC. Nothing of theirs is copied into the app, only paraphrased facts. The sentence above is what keeps that true. I am not a lawyer; if you want certainty, read each licence page once.

## 9. Kiro prompt

> Open `apps/shot-rail/docs/shot-rail-text-pack.md`. Do not research and do not reword anything.
> 1. Make the four spec edits in section 5.
> 2. Create the two files in sections 2 and 3, character for character.
> 3. Replace the table in `docs/sources.md` with the table in section 4.
> 4. Add the section from section 8 to `THIRD_PARTY.md`.
> 5. Change no other file. Do not start Task 38.1. Add one build-notes entry. Stop and report.

I run `npm.cmd test` and paste the result. Expected: Shot Rail gains 1 file and 11 tests, 0 skipped.

## 10. Honest limits

- Lens lines for 24, 35, 50 and 85 mm lean on one encyclopedia page for "normal lens". That page also says cinematography often treats a wider lens as normal. The text says "for this frame" to stay true.
- The Bowen and Thompson passage was read from a publisher preview that stops mid-sentence.
- Bearing, height, distances, elevation and fill are the app's own terms. Their lines have no source and say only what the app measures.
- Push-in means moving toward the subject (LibreTexts). One Berkeley page uses "dolly" differently. The text uses the LibreTexts meaning.
- The motion-check wordings in `findings.ts` are the app's own rules, not world facts. They were not changed.
