// Which control panel is shown in which mode (Requirements 7.13, 8.16). Pure: no DOM, no three.
//
// cameras (camera list and Add camera), placement (bearing, height, Horizontal_Distance) and lens are shown
// in Angle mode only. The shot panel (Shot_Type, Shot_Length and the 'Main camera: <id>' line) is shown in
// Move mode only. The sample menu, the guides, the Timeline, the Readout and the Motion_Check are shown in
// both modes, so they are not listed here.

import type { GridMode } from './coverage-grid-rules.js';

export type PanelId = 'cameras' | 'placement' | 'lens' | 'shot';

export function isPanelVisible(panel: PanelId, mode: GridMode): boolean {
  return panel === 'shot' ? mode === 'move' : mode === 'angle';
}
