// About_Panel text (Task 20.6 gives access to the panel; Task 22.1 writes the honest limits).
// Requirements 24.1, 24.2 and 24.4 are stated here. The gesture statements of 24.5 to 24.9 are written when Tier B is built;
// Tier A states only that hand gestures are not available. Plain text, set with textContent.
// Requirement 24.3: this panel does not say which parts of the app use PathKit. That is in the README.

export const ABOUT_TITLE = 'About Skeleton Bench';

export const ABOUT_LINES: readonly string[] = [
  'The Machines are simplified models built from shapes. They are not to scale with each other, because they share one stage box.',
  'The specifications are invented sample data.',
  'PathKit cannot follow a live hand, because it bakes ahead of time.',
  'Hand gestures are not available in this version.',
];
