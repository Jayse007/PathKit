// Timeline (task 34.1): a play/pause button, a scrub slider, a frame counter and marks at the frames of
// the findings. It owns the transport state and the one animation-frame loop. It touches the DOM and reads
// the clock (performance.now and the requestAnimationFrame timestamp), so no test imports this file. The
// pure rules (counter texts, mark frames) are in timeline-rules.ts. All play, pause, seek and step logic
// is in ../logic/playback.ts; this file only calls it.
//
// The Timeline never bakes: it has no way to. It reports each change of frame (or of playing) through
// onChange, and the caller evaluates and draws. It starts paused at frame 0 and never starts by itself:
// only a press of the Play button calls playPlayback.
//
// The animation-frame loop runs only while playing. Per step it makes one small PlaybackState object,
// because stepPlayback returns a new one. Nothing else is created per frame: the loop function, the tick
// object, the counter texts and the marks are made once (or at setShot).

import { scrubToFrame } from '../logic/frame-mapper.js';
import type { Finding } from '../logic/pathkit.js';
import {
  initialPlaybackState,
  pausePlayback,
  playPlayback,
  seekPlayback,
  stepPlayback,
} from '../logic/playback.js';
import type { PlaybackState } from '../logic/playback.js';
import type { CameraRig } from './camera-rig.js';
import {
  buildFrameCounterTexts,
  findingMarkFraction,
  findingMarkFrames,
  findingMarksSummary,
  lastFrameOf,
} from './timeline-rules.js';

// View-only values (not in the design's Named constants table).
const SCRUB_ID = 'timeline-scrub';
const PLAY_TEXT = 'Play';
const PAUSE_TEXT = 'Pause';
const PLAY_TOOLTIP =
  'Play the shot from the current frame, at 30 frames per second. It stops at the last frame. Tab to this button, then press Space or Enter.';
const PAUSE_TOOLTIP = 'Pause on the current frame. Tab to this button, then press Space or Enter.';
const SCRUB_LABEL = 'Scrub';
const SCRUB_TOOLTIP =
  'Go to any frame of the shot. Drag, or Tab to it and use Left and Right (one frame), Home (first frame) and End (last frame). Scrubbing pauses playback.';
const COUNTER_TOOLTIP = 'The frame on screen, the last frame, and the time at 30 frames per second.';
const MARKS_TOOLTIP = 'Marks show the frames where the motion check found something.';
const MARK_COLOUR = '#c0392b';
const MARK_WIDTH_PX = 3;
const MARK_HEIGHT_PX = 12;
const THUMB_WIDTH_PX = 16; // the slider thumb is about this wide; marks are inset by half of it at each end
const ROW_GAP_PX = 12;
const NOT_SHOWN = -1;

/** What changed. One object, reused for every call of onChange; read it, do not keep it. */
export interface TimelineTick {
  /** The displayed frame to show. A whole number in [0, last frame]. */
  frame: number;
  /** Whether the Timeline is playing after this change. */
  playing: boolean;
  /** Clock time of this change in ms (the animation-frame timestamp in the loop, performance.now otherwise). */
  nowMs: number;
  /** true for every change except a plain step of the loop; false means "grid: redraw at the 10 Hz rate only". */
  gridChanged: boolean;
}

export interface TimelineOptions {
  /** Mirrors the transport state (setDisplayedFrame, setPlaying) so BakeOutcome reports it. Never bakes. */
  rig: CameraRig;
  shotLengthFrames: number;
  /** The findings to mark (the main camera's, from rig.findingsForMain()). */
  findings: readonly Finding[];
  /** Called when the frame or the playing flag changes. Evaluate and draw here. */
  onChange: (tick: Readonly<TimelineTick>) => void;
}

export interface Timeline {
  /** The displayed frame. */
  frame(): number;
  isPlaying(): boolean;
  /** Pause. Calls onChange only when it was playing. Call this before and after any re-bake or settings change. */
  pause(): void;
  /**
   * A new shot (after a re-bake): pauses, keeps the frame inside the new range, rebuilds the slider range,
   * the counter and the marks. Does NOT call onChange: the caller draws the frame (see frame()).
   */
  setShot(shotLengthFrames: number, findings: readonly Finding[]): void;
  /** Stop the loop and remove the controls. */
  dispose(): void;
}

/** Builds the Timeline inside `container`. Starts paused at frame 0. Does not call onChange: draw frame 0 yourself. */
export function createTimeline(container: HTMLElement, options: TimelineOptions): Timeline {
  const { rig, onChange } = options;

  let lastFrame = lastFrameOf(options.shotLengthFrames);
  let counterTexts = buildFrameCounterTexts(options.shotLengthFrames);
  let state: PlaybackState = initialPlaybackState();

  // --- controls (setup, runs once) ---------------------------------------------------------
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = `${ROW_GAP_PX}px`;

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = PLAY_TEXT;
  playButton.title = PLAY_TOOLTIP;

  const scrubLabel = document.createElement('label');
  scrubLabel.htmlFor = SCRUB_ID;
  scrubLabel.textContent = SCRUB_LABEL;
  scrubLabel.title = SCRUB_TOOLTIP;

  const track = document.createElement('div');
  track.style.flex = '1 1 auto';
  track.style.minWidth = '0';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = SCRUB_ID;
  slider.min = '0';
  slider.max = String(lastFrame);
  slider.step = '1';
  slider.value = '0';
  slider.title = SCRUB_TOOLTIP;
  slider.style.display = 'block';
  slider.style.width = '100%';
  slider.style.margin = '0';

  const markBar = document.createElement('div');
  markBar.title = MARKS_TOOLTIP;
  markBar.style.position = 'relative';
  markBar.style.height = `${MARK_HEIGHT_PX}px`;
  track.append(slider, markBar);

  const counter = document.createElement('span');
  counter.title = COUNTER_TOOLTIP;
  counter.style.whiteSpace = 'nowrap';
  counter.style.fontVariantNumeric = 'tabular-nums';

  const summary = document.createElement('div');
  summary.title = MARKS_TOOLTIP;

  row.append(playButton, scrubLabel, track, counter);
  container.replaceChildren(row, summary);

  // --- marks (setup, and again at setShot) -------------------------------------------------
  const buildMarks = (findings: readonly Finding[]): void => {
    const frames = findingMarkFrames(findings, lastFrame);
    const marks: HTMLElement[] = [];
    for (const frame of frames) {
      const mark = document.createElement('span');
      mark.title = `Finding at frame ${frame}`;
      mark.style.position = 'absolute';
      mark.style.top = '0';
      mark.style.width = `${MARK_WIDTH_PX}px`;
      mark.style.height = `${MARK_HEIGHT_PX}px`;
      mark.style.background = MARK_COLOUR;
      mark.style.transform = 'translateX(-50%)';
      const fraction = findingMarkFraction(frame, lastFrame);
      mark.style.left = `calc(${THUMB_WIDTH_PX / 2}px + (100% - ${THUMB_WIDTH_PX}px) * ${fraction})`;
      marks.push(mark);
    }
    markBar.replaceChildren(...marks);
    summary.textContent = findingMarksSummary(frames);
  };
  buildMarks(options.findings);

  // --- state to screen ---------------------------------------------------------------------
  let shownFrame = NOT_SHOWN;
  let shownPlaying = false;
  const tick: TimelineTick = { frame: 0, playing: false, nowMs: 0, gridChanged: true };

  // Per-frame path: assigns numbers, and strings that already exist. Creates nothing.
  const syncControls = (): void => {
    if (state.frame !== shownFrame) {
      slider.valueAsNumber = state.frame;
      counter.textContent = counterTexts[state.frame];
      shownFrame = state.frame;
    }
    if (state.playing !== shownPlaying) {
      playButton.textContent = state.playing ? PAUSE_TEXT : PLAY_TEXT;
      playButton.title = state.playing ? PAUSE_TOOLTIP : PLAY_TOOLTIP;
      shownPlaying = state.playing;
    }
    rig.setDisplayedFrame(state.frame);
    rig.setPlaying(state.playing);
  };
  counter.textContent = counterTexts[0];
  shownFrame = 0;

  // A failure while drawing (a caller defect, design: evaluateEntity errors) is logged and the frame is
  // skipped, so the loop is never killed by it.
  const publish = (nowMs: number, gridChanged: boolean): void => {
    syncControls();
    tick.frame = state.frame;
    tick.playing = state.playing;
    tick.nowMs = nowMs;
    tick.gridChanged = gridChanged;
    try {
      onChange(tick);
    } catch (e) {
      console.error('Timeline: drawing a frame failed and the frame was skipped.', e);
    }
  };

  // --- the animation-frame loop: runs only while playing -----------------------------------
  let rafId = 0;
  let lastTimestamp = -1; // -1: no timestamp yet since play started

  const stopLoop = (): void => {
    if (rafId !== 0) window.cancelAnimationFrame(rafId);
    rafId = 0;
    lastTimestamp = -1;
  };

  // Created once. The only reads of the clock in the loop are the timestamp argument.
  const loop = (timestamp: number): void => {
    rafId = 0;
    if (!state.playing) {
      lastTimestamp = -1;
      return;
    }
    const elapsedMs = lastTimestamp < 0 ? 0 : Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    const before = state.frame;
    state = stepPlayback(state, elapsedMs, lastFrame); // one small object per step (the pure API returns a new one)
    const stopped = !state.playing;
    if (state.frame !== before || stopped) publish(timestamp, stopped);
    if (state.playing) {
      rafId = window.requestAnimationFrame(loop);
    } else {
      lastTimestamp = -1;
    }
  };

  // --- user actions ------------------------------------------------------------------------
  const pauseNow = (): void => {
    state = pausePlayback(state);
    stopLoop();
    publish(performance.now(), true);
  };

  playButton.addEventListener('click', () => {
    if (state.playing) {
      pauseNow();
      return;
    }
    state = playPlayback(state, lastFrame); // the only place playback starts
    lastTimestamp = -1;
    rafId = window.requestAnimationFrame(loop);
    publish(performance.now(), true);
  });

  // Scrubbing takes over from playback: it pauses (it never starts playback). A value that is not a
  // finite number is ignored (design: error handling for the scrub value).
  slider.addEventListener('input', () => {
    let frame: number;
    try {
      frame = scrubToFrame(slider.valueAsNumber, lastFrame);
    } catch {
      return;
    }
    stopLoop();
    state = pausePlayback(seekPlayback(state, frame, lastFrame));
    publish(performance.now(), true);
  });

  return {
    frame(): number {
      return state.frame;
    },
    isPlaying(): boolean {
      return state.playing;
    },
    pause(): void {
      if (!state.playing) return;
      pauseNow();
    },
    setShot(shotLengthFrames: number, findings: readonly Finding[]): void {
      const nextLast = lastFrameOf(shotLengthFrames); // throws before anything changes
      stopLoop();
      lastFrame = nextLast;
      counterTexts = buildFrameCounterTexts(shotLengthFrames);
      state = seekPlayback(pausePlayback(state), state.frame, lastFrame);
      slider.max = String(lastFrame);
      buildMarks(findings);
      shownFrame = NOT_SHOWN;
      syncControls();
    },
    dispose(): void {
      stopLoop();
      container.replaceChildren();
    },
  };
}
