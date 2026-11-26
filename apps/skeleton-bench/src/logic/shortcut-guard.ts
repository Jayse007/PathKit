/**
 * Keyboard shortcut guard. Pure: no state. App code, not PathKit.
 * Shortcuts are ignored while focus is in a text field, select or range slider.
 */

export type ActiveElementKind =
  | 'text-input'
  | 'textarea'
  | 'select'
  | 'range-input'
  | 'button'
  | 'none';

/** False for text input, textarea, select and range input. True for a button or no focus. */
export function shouldHandleShortcut(activeElementKind: ActiveElementKind): boolean {
  switch (activeElementKind) {
    case 'text-input':
    case 'textarea':
    case 'select':
    case 'range-input':
      return false;
    case 'button':
    case 'none':
      return true;
    default:
      throw new Error(
        `shouldHandleShortcut: unknown element kind ${String(activeElementKind)}`,
      );
  }
}

/** Input types that take typed text. Other types (button, checkbox, range, ...) are handled elsewhere. */
const TEXT_INPUT_TYPES: readonly string[] = [
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  '',
];

/** Maps a focused element (or null) to a kind. Takes only the two fields it reads, so it needs no DOM in tests. */
export function activeElementKind(
  element: { readonly tagName: string; readonly type?: string } | null | undefined,
): ActiveElementKind {
  if (element === null || element === undefined) return 'none';
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  if (tag === 'input') {
    const type = (element.type ?? '').toLowerCase();
    if (type === 'range') return 'range-input';
    if (TEXT_INPUT_TYPES.includes(type)) return 'text-input';
    return 'button';
  }
  return 'button';
}
