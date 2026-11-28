// Samples menu (task 40.1): a labelled drop-down list of the sample shots, at the top of the controls column.
// Choosing a sample asks the caller to load it. The caller does the work (pause, re-bake, redraw, back to
// frame 0), so loading takes the same path as any other change of settings and never starts playback.
//
// It touches the DOM, so no test imports this file. The settings built from a sample are in
// samples-menu-rules.ts (pure). The menu is a native <select>, so it works with the keyboard (arrow keys).
// Each option's tooltip is the Term_Text line of its shot type.

import type { SampleShot } from '../logic/samples.js';
import { SHOT_TYPE_TERMS } from '../logic/term-text.js';

// View-only values (not in the design's Named constants table).
const SELECT_ID = 'sample-shot';
const FIELD_CLASS = 'field';
const LABEL_TEXT = 'Sample shot';
const SELECT_TOOLTIP =
  'Load a ready-made shot. It replaces the camera settings and leaves the timeline paused at frame 0.';

export interface SamplesMenuOptions {
  /** The samples to list, in order. */
  samples: readonly SampleShot[];
  /** The index shown at the start (the sample the app started with). */
  initialIndex: number;
  /** Load the sample at this index. Returns false when it could not be loaded (the old settings stay). */
  onLoad: (index: number) => boolean;
}

export interface SamplesMenu {
  /** Show the sample at this index without loading it. */
  show(index: number): void;
}

/** Builds the menu inside `container`. Call once. */
export function createSamplesMenu(container: HTMLElement, options: SamplesMenuOptions): SamplesMenu {
  const { samples, onLoad } = options;

  const wrap = document.createElement('div');
  wrap.className = FIELD_CLASS;

  const label = document.createElement('label');
  label.htmlFor = SELECT_ID;
  label.textContent = LABEL_TEXT;
  label.title = SELECT_TOOLTIP;

  const select = document.createElement('select');
  select.id = SELECT_ID;
  select.title = SELECT_TOOLTIP;
  for (let i = 0; i < samples.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = samples[i].name;
    option.title = SHOT_TYPE_TERMS[samples[i].shotType].text;
    select.appendChild(option);
  }

  wrap.append(label, select);
  container.replaceChildren(wrap);

  let shownIndex = options.initialIndex;
  const show = (index: number): void => {
    shownIndex = index;
    select.value = String(index);
  };
  show(options.initialIndex);

  select.addEventListener('change', () => {
    const index = Number(select.value);
    if (!Number.isInteger(index) || index < 0 || index >= samples.length) {
      show(shownIndex);
      return;
    }
    if (onLoad(index)) {
      shownIndex = index;
    } else {
      show(shownIndex); // the old settings stay, so the menu keeps showing the sample they came from
    }
  });

  return { show };
}
