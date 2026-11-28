// Capture (task 45.1): saves the Main_Camera view at the frame shown now as a PNG, through a plain download
// link (a temporary <a download> with an object URL). Uses the canvas toBlob function, no library and no
// network request (requirements 13.1 to 13.5). It touches the DOM, so no test imports this file. The file name
// is made by ../logic/capture-name.ts (pure).
//
// How the picture is read: a WebGL canvas is cleared after the browser composites it, and the main view does
// not keep its drawing buffer (that would slow every frame). So Capture calls view.renderNow(), which draws the
// current camera state at once, and calls canvas.toBlob in the same call, before the browser can composite.
// toBlob copies the bitmap at the moment it is called; only the encoding finishes later.
//
// The guides overlay is a separate 2D canvas, so it is not in the picture (the spec asks for the Main_Camera
// view). Capture does not start or stop playback and does not move the Timeline: it reads the frame the
// Timeline shows at that moment. It runs on a click or the C key only, never per frame.

import { captureFileName } from '../logic/capture-name.js';
import type { MainView } from './main-view.js';

// View-only values (not in the design's Named constants table).
const BUTTON_ID = 'capture-button';
const BUTTON_TEXT = 'Capture';
const KEY_LETTER = 'C';
const BUTTON_TOOLTIP = `Save the main view at the frame shown now as a PNG file (key ${KEY_LETTER}). The guides are not drawn in it.`;
const PNG_TYPE = 'image/png';
/** How long the object URL is kept after the click, so the browser can start the download. */
const REVOKE_DELAY_MS = 1000;
const FAILURE_ADVICE = "Try again, or use the browser's own screenshot tool.";
const NO_VIEW_MESSAGE = `The picture could not be saved: the 3D view is not running. Reload the page, then try again. ${FAILURE_ADVICE}`;
const NO_PNG_MESSAGE = `The picture could not be saved: the browser could not make a PNG from the 3D view. ${FAILURE_ADVICE}`;
const ERROR_MESSAGE_PREFIX = 'The picture could not be saved: the browser refused to read the 3D view';

export interface CaptureOptions {
  /** The main view; only renderNow is used. */
  view: Pick<MainView, 'renderNow'>;
  /** The shot name for the file name (read at the moment of capture). */
  getShotName: () => string;
  /** The frame the Timeline shows now (read at the moment of capture). */
  getFrame: () => number;
  /** Shows a plain message in the status line. */
  onStatus: (message: string) => void;
}

export interface Capture {
  /** Save the current frame as a PNG now. Never throws; a failure goes to onStatus. */
  capture(): void;
  /** Remove the button listener. */
  dispose(): void;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Wires the button #capture-button in index.html (label, tooltip, click). Returns the Capture, which the
 * C key also calls. If the button is missing, the key still works.
 */
export function createCapture(options: CaptureOptions): Capture {
  const button = document.getElementById(BUTTON_ID);
  const onClick = (): void => capture();

  // Starts the download of `blob` under `fileName`, then frees the object URL.
  const download = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    options.onStatus(`Saved the picture as ${fileName}. It is in your browser's downloads.`);
  };

  const capture = (): void => {
    try {
      // Read both now, so the name matches the picture even if playback moves on while the PNG is encoded.
      const frame = options.getFrame();
      const fileName = captureFileName(options.getShotName(), frame);
      const canvas = options.view.renderNow();
      if (canvas === null) {
        options.onStatus(NO_VIEW_MESSAGE);
        return;
      }
      canvas.toBlob((blob: Blob | null) => {
        if (blob === null) {
          options.onStatus(NO_PNG_MESSAGE);
          return;
        }
        try {
          download(blob, fileName);
        } catch (e) {
          options.onStatus(`The picture could not be saved: the browser refused the download (${errorText(e)}). ${FAILURE_ADVICE}`);
        }
      }, PNG_TYPE);
    } catch (e) {
      options.onStatus(`${ERROR_MESSAGE_PREFIX} (${errorText(e)}). ${FAILURE_ADVICE}`);
    }
  };

  if (button !== null) {
    button.textContent = `${BUTTON_TEXT} (${KEY_LETTER})`;
    button.title = BUTTON_TOOLTIP;
    button.addEventListener('click', onClick);
  }

  return {
    capture,
    dispose(): void {
      if (button !== null) button.removeEventListener('click', onClick);
    },
  };
}
