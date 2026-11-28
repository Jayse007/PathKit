// Pure keyboard map for Shot Rail. See the design's Keyboard map.
// No DOM, no I/O, no clock, no randomness. Action names are neutral labels;
// the view decides what each one does.

// `key` is the `KeyboardEvent.key` string: ' ' (space), 'ArrowLeft',
// 'ArrowRight', 'Home', 'End', letters, digits, '+', '=', '-', '?'.

export type KeyAction =
  | 'toggle-play'
  | 'step-back'
  | 'step-forward'
  | 'first-frame'
  | 'last-frame'
  | 'mode-angle'
  | 'mode-move'
  | 'select-slot-1'
  | 'select-slot-2'
  | 'select-slot-3'
  | 'select-slot-4'
  | 'select-slot-5'
  | 'select-slot-6'
  | 'cycle-lens'
  | 'zoom-in'
  | 'zoom-out'
  | 'cycle-shot-type'
  | 'toggle-thirds'
  | 'toggle-safe-area'
  | 'capture-frame'
  | 'open-about';

export interface PrimaryKey {
  readonly action: KeyAction;
  readonly key: string; // letters are lower case here; matching ignores case
}

// One row per action, one primary key each.
export const PRIMARY_KEYS: readonly PrimaryKey[] = [
  { action: 'toggle-play', key: ' ' },
  { action: 'step-back', key: 'ArrowLeft' },
  { action: 'step-forward', key: 'ArrowRight' },
  { action: 'first-frame', key: 'Home' },
  { action: 'last-frame', key: 'End' },
  { action: 'mode-angle', key: 'a' },
  { action: 'mode-move', key: 'm' },
  { action: 'select-slot-1', key: '1' },
  { action: 'select-slot-2', key: '2' },
  { action: 'select-slot-3', key: '3' },
  { action: 'select-slot-4', key: '4' },
  { action: 'select-slot-5', key: '5' },
  { action: 'select-slot-6', key: '6' },
  { action: 'cycle-lens', key: 'l' },
  { action: 'zoom-in', key: '+' },
  { action: 'zoom-out', key: '-' },
  { action: 'cycle-shot-type', key: 's' },
  { action: 'toggle-thirds', key: 't' },
  { action: 'toggle-safe-area', key: 'g' },
  { action: 'capture-frame', key: 'c' },
  { action: 'open-about', key: '?' },
];

// Every action, in table order.
export const KEY_ACTIONS: readonly KeyAction[] = PRIMARY_KEYS.map((row) => row.action);

// Extra keys that give the same action as a primary key. '=' is the
// unshifted '+' key on most layouts.
export const KEY_ALIASES: readonly PrimaryKey[] = [{ action: 'zoom-in', key: '=' }];

const LOOKUP: ReadonlyMap<string, KeyAction> = new Map<string, KeyAction>([
  ...PRIMARY_KEYS.map((row): [string, KeyAction] => [row.key, row.action]),
  ...KEY_ALIASES.map((row): [string, KeyAction] => [row.key, row.action]),
]);

// Returns the action for a key, or null. Returns null while focus is in a
// text or number field. Single-character keys are matched ignoring case, so
// 'A' (Shift or Caps Lock) acts like 'a'. Named keys ('ArrowLeft') are exact.
// '+' and '?' arrive as those characters when Shift is held, so they need no
// special handling. Modifier checks (Ctrl, Meta, Alt) belong to the caller,
// which should not call this for those presses.
export function actionForKey(key: string, focusInTextField: boolean): KeyAction | null {
  if (focusInTextField) return null;
  const normalised = key.length === 1 ? key.toLowerCase() : key;
  return LOOKUP.get(normalised) ?? null;
}
