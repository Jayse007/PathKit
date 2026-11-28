// Capture file name (task 45.1). Pure: no DOM, no I/O, no clock, no randomness; the inputs are not changed.
//
// Format, from tasks.md 45.1 and requirements 13.3: "Pure file name from the shot name and frame (for example
// `shot-orbit-around-the-car-frame-0120.png`, characters other than letters, digits and hyphens replaced)."
//   shot-<slug>-frame-<frame, at least 4 digits>.png
// The spec names no date, time or id in the file name, so none is used.
//
// Choices the spec leaves open (listed in the task report):
// - The slug is the shot name in lower case. "Letters" means the ASCII letters a to z (so an accented or
//   non-Latin letter is replaced). Every run of other characters, and every run of hyphens, becomes one hyphen.
//   Hyphens at the start and end are dropped.
// - The frame is padded with zeros to 4 digits. A frame of 10000 or more keeps all its digits.
// - A slug that is empty after this (an empty name, or a name of only symbols) is left out with its hyphen:
//   `shot-frame-0120.png`.
// - The slug is cut to 60 characters (then a trailing hyphen is dropped) so the whole name stays short.
//
// Safe on Windows: the slug holds only a to z, 0 to 9 and "-", so none of \ / : * ? " < > | can appear, there is
// no dot or space at the end, and the name always starts with "shot-", so no reserved device name (such as CON)
// can occur. The only dot is the one before "png".

const FILE_PREFIX = 'shot';
const FRAME_WORD = 'frame';
const FILE_EXTENSION = 'png';
const SEPARATOR = '-';
const FRAME_DIGITS_MIN = 4;
const SLUG_MAX_LENGTH = 60;
const NOT_ALLOWED_RUN = /[^a-z0-9-]+/g;
const HYPHEN_RUN = /-{2,}/g;
const EDGE_HYPHENS = /^-+|-+$/g;
const FRAME_MIN = 0;

/**
 * The shot name as lower-case letters, digits and single hyphens (see the choices above). May be empty.
 * Throws an Error naming the function and the value if `shotName` is not a string.
 */
export function captureSlug(shotName: string): string {
  if (typeof shotName !== 'string') {
    throw new Error(`captureSlug: the shot name must be a string, got ${String(shotName)}`);
  }
  const cleaned = shotName
    .toLowerCase()
    .replace(NOT_ALLOWED_RUN, SEPARATOR)
    .replace(HYPHEN_RUN, SEPARATOR)
    .replace(EDGE_HYPHENS, '');
  return cleaned.slice(0, SLUG_MAX_LENGTH).replace(EDGE_HYPHENS, '');
}

/**
 * The file name for a capture of `shotName` at displayed frame `frame`.
 * Throws an Error naming the function and the value if `shotName` is not a string, or `frame` is not a whole
 * number of 0 or more.
 */
export function captureFileName(shotName: string, frame: number): string {
  if (typeof shotName !== 'string') {
    throw new Error(`captureFileName: the shot name must be a string, got ${String(shotName)}`);
  }
  if (!Number.isSafeInteger(frame) || frame < FRAME_MIN) {
    throw new Error(`captureFileName: the frame must be a whole number of ${FRAME_MIN} or more, got ${String(frame)}`);
  }
  const slug = captureSlug(shotName);
  const digits = String(frame).padStart(FRAME_DIGITS_MIN, '0');
  const middle = slug === '' ? '' : `${SEPARATOR}${slug}`;
  return `${FILE_PREFIX}${middle}${SEPARATOR}${FRAME_WORD}${SEPARATOR}${digits}.${FILE_EXTENSION}`;
}
