// Colours of the page chrome (panels, text, buttons). The chrome stays dark in both Looks.
// index.html holds the same values as CSS variables; test/contrast.test.ts checks they match.
// App code, no PathKit, no three.

export const CHROME_PALETTE = {
  /** Page background, and the fill of buttons and cards. */
  bg: '#10151b',
  /** Side panels and the Control_Bar. */
  panel: '#18202a',
  /** Background of an opened Part's details. */
  panelOpen: '#1f2a37',
  /** Background of a hovered button. */
  hover: '#222c38',
  /** Border of every button and card (a control boundary). */
  controlBorder: '#8b98a6',
  /** Main text. */
  text: '#e6edf3',
  /** Secondary text and labels. */
  muted: '#b4c0cc',
  /** The orange accent: selection borders and message borders. */
  accent: '#ff8a1f',
  /** Keyboard focus ring. */
  focusRing: '#5cc8ff',
} as const;
