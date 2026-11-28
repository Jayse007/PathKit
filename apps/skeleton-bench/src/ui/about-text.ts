// About_Panel text (Task 20.6 gives access to the panel; Task 22.1 writes the full list of honest limits).
// Requirements 24.1, 24.2 and 24.4 to 24.9. Plain text, set with textContent.
// Requirement 24.3: this panel does not say which parts of the app use PathKit. That is in the README.

export const ABOUT_TITLE = 'About Skeleton Bench';

export const ABOUT_LINES: readonly string[] = [
  'The Machines are simplified models built from shapes. They are not to scale with each other, because they share one stage box.',
  'The specifications are invented sample data.',
  'PathKit cannot follow a live hand, because it bakes ahead of time.',
  'Hand gestures are not available in this version. When they are added, they will need a webcam, good light and a page served over HTTPS.',
  'Two-hand zoom is the least stable gesture.',
  'Moving the Machine has no gesture. Use the mouse or the arrow keys in Move mode.',
  'The pose classifier is our own code over the 21 hand points. No second model is used.',
  'Hand tracking will use MediaPipe, which sends usage metrics to Google.',
];
