// About_Panel text (Task 20.6 gives access to the panel; Task 22.1 writes the full list of honest limits).
// Only the limits that are true today are listed here (Requirements 24.1, 24.2 and 24.4). Plain text, set with textContent.

export const ABOUT_TITLE = 'About Skeleton Bench';

export const ABOUT_LINES: readonly string[] = [
  'The Machines are simplified models built from shapes. They are not to scale with each other, because they share one stage box.',
  'The specifications are invented sample data.',
  'PathKit cannot follow a live hand, because it bakes ahead of time.',
  'This list of limits is not complete yet. The gesture limits will be added when they apply.',
];
