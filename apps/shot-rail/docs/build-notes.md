# Build notes

## Task 42.2: About_Panel text tests (newest entry, kept at top)

- Done: new `test/view/about-panel-rules.test.ts` (9 `it`/`it.each` calls, 23 tests expected in Vitest). Checks: six limit lines in order with hand-written key phrases; the five third-party rows (name, version, licence) equal hand-written literals; each row version equals the pinned value in `package.json` (read with `import ... from '../../package.json?raw'`, the only outside value); `thirdPartyLine` on a hand-written row; five section ids and headings in order, no empty section or line; `aboutFullText()` has the title and headings and no "figure" or "abstract". No src, package.json or tsconfig change.
- Broke / Kiro got wrong: nothing known. Not run.
- PathKit feature used: none (pure text module).
- Not tested: wording quality (task 42.3), the DOM panel, focus, Escape, layout, a browser. The tests read the text module only, not what the panel shows.

## Task 42.1 fix: About Close button always visible (newest entry, kept at top)

- Done: in `index.html` the title and Close button are now one `<header id="about-header">` (flex, space-between) as the first child of the dialog, before `#about-body`. The dialog itself scrolls (`overflow-y: auto`, padding 0); the header is `position: sticky; top: 0; z-index: 1` with `background: var(--panel-bg)` (the dialog's colour). The old 16px dialog padding moved into the header (8px 16px) and `#about-body` (0 16px 16px), so no gap sits above the header. `about-panel.ts`: comments only; focus (autofocus on Close, return to the opener), `showModal()` and the `scrollTop` reset are unchanged. No text constant changed.
- Not tested: nothing was run; not opened in a browser.

## Task 42.1: About_Panel (newest entry, kept at top)

- Done: new pure `src/view/about-panel-rules.ts` (all About text as named constants, `ABOUT_SECTIONS`, `ABOUT_LIMIT_LINES`, `THIRD_PARTY_ROWS`, `thirdPartyLine`, `aboutFullText`) and `src/view/about-panel.ts` (`createAboutPanel()` returns `{ open, close, isOpen, dispose }` or null; DOM). `index.html`: an About button at the bottom of the controls column (`#about-button`, visible label "About", tooltip with the `?` key) and a native `<dialog id="about-panel">` opened with `showModal()`; CSS reuses the existing colours. `main.ts`: the panel is created right after `applyLayout` (before the early returns, so the button works even if WebGL fails) and `onOpenAbout` is passed to the keyboard. `keyboard.ts`: new `onOpenAbout` option, `open-about` now runs it, and every key is ignored while a `dialog[open]` exists. `keyboard-rules.ts`: `open-about` removed from `UNHANDLED_ACTIONS`. Keys inside the open dialog are stopped by a capture-phase keydown listener on the document, so `hints.ts` (its own Escape), `guides-view.ts` (T, G) and `keyboard.ts` never see them; Escape closes the panel and returns focus to the element that had it. The car is the only Subject, so the text names only the car. Nothing under src/logic, camera-rig.ts or coverage-grid-rules.ts changed.
- Text: the six limit statements follow Requirements 21.1 to 21.5 and 21.8. The last two sentences of the scenes statement (S6 Outcome A, only the main camera can be a rail shot), the section headings, the keys line, the third-party intro and the "use" words are DRAFT for the User to approve at 42.3.
- Not tested: nothing was run. No tests yet (42.2). Not opened in a browser (look, focus into the dialog, Escape, focus return, Tab inside the dialog, scrolling of a long panel, screen-reader reading).

## Clean-ups: Straight_Line_Distance wording and mode message (newest entry, kept at top)

- Done: spec wording only. The Straight_Line_Distance is in the Readout in both modes, not in the placement panel: requirements.md 7.13, tasks.md 37.1c and the design.md "Controls by mode" paragraph now say so (7.3 unchanged). In `main.ts`, `MODE_CHANGED_MESSAGE` is now 'Angle mode: place cameras. Move mode: choose the shot type and length.' and the comments on `mode` and `applyMode` say the mode also decides which control panels are shown. No test quoted the old message.
- Not tested: nothing was run. Not opened in a browser.

## Controls by mode and new hint wording, 28 November 2026, part B (newest entry, kept at top)

- Decision (28 November 2026, by the User): Angle mode shows the camera list with Add camera, the placement fields and the lens controls. Move mode shows Shot_Type, Shot_Length and a 'Main camera: <id>' line. The sample menu, guides, Timeline, Readout and Motion_Check show in both modes. New hint wording for both modes.
- Spec: `requirements.md` criteria 7.13, 7.14 and 8.16 added. `design.md` has one paragraph "Controls by mode" after the Coverage_Grid paragraph in "Rendering layer" (there is no controls section). `tasks.md` has new unchecked sub-tasks 37.1c and 41.3. No requirement quotes the old hint wording (18.3 quotes none), so no spec wording was replaced.
- Code: new pure `src/view/mode-panels-rules.ts` (`PanelId`, `isPanelVisible`). `src/view/controls.ts`: `setMode` now also sets `hidden` on the camera group, the placement box, `#lens-field` and `#controls-after-lens`; a 'Main camera: <id>' line is the first child of `#controls-after-lens`, updated in `show()` only when its text changes; focus moves to the active mode button when the focused element is hidden. `index.html`: rule `#controls-column [hidden] { display: none !important; }` (`.field` sets `display:flex`, which beats the `hidden` attribute) and a `.main-line` margin. `src/view/hints-rules.ts`: new hint wording. `src/main.ts`: the L, + / - and S keys now set the status line ('Lens: <mm> mm.' and 'Shot type: <type>.').
- Tests: new `test/view/mode-panels-rules.test.ts` (8 rows). `test/view/hints-rules.test.ts`: the two text literals only.
- Not tested: nothing was run. Not opened in a browser (hiding, focus move, layout, the key messages).

## Remembered rail shot removed, 28 November 2026, part A

- Decision (28 November 2026, by the User): the remembered rail shot (task 37.1b) is removed. A camera that stops being the Main_Camera stays an orbit camera, as in the original rule of Requirement 7.5. The field `railShotWhenMain`, the "is back to" message and the "(push-in when main)" text in the camera list are gone.
- Spec: `requirements.md` Requirement 7 criterion 5 back to the push-in/crane to orbit rule only. `design.md` paragraph "Remembered rail shot (Requirement 7.5)" deleted. `tasks.md` task 37.1b is now `[ ]*` "REMOVED", with a removed note; not to be built.
- Code: `src/view/camera-rig.ts` (field removed from `CameraSetting`), `src/view/coverage-grid-rules.ts` (`planMainChange` back to conversion only), `src/view/controls-rules.ts` (`withShotType` and `withAddedCamera` simplified, `change` helper and mainCopy line removed), `src/view/controls.ts` (`shotText` removed, plain `shotType` passed to `fillRow`, unused `CameraSetting` import removed), `src/view/samples-menu-rules.ts` (comments only).
- Tests: `test/view/coverage-grid-rules.test.ts` (the 5-test "remembered rail shot" describe block deleted, `railShotWhenMain` removed from one expected object), `test/view/samples-menu-rules.test.ts` (test renamed "...has exactly the six named keys", the `railShotWhenMain` check and header mention removed). `test/view/hints-rules.test.ts` was already fixed.
- Not tested: nothing was run. Part B is separate.

## Task 41.2: hint tests (newest entry, kept at top)

- Done: new `test/view/hints-rules.test.ts`, 11 `it` blocks (21 tests as Vitest counts them: `hintToShow` 8 rows, `hintTextForMode` 2, `hintStorageKey` 2, write-and-read-back 2, and 7 single blocks). Expected texts, keys ('hintSeenAngle', 'hintSeenMove') and stored keys ('shot-rail:hintSeenAngle', 'shot-rail:hintSeenMove') are hand-written literals. The remembered flag is tested through `readSetting`/`writeSetting` with a mock `StorageLike` and `hintStorageKey`, including missing value, invalid JSON, a throwing storage, and the two modes being independent. No src file changed.
- Not tested: nothing was run. `hints.ts` is not imported (it needs the DOM): Escape dismissal, focus return to `#stage`, the in-memory seen flag, the `=== true` check on a stored non-boolean, the show/hide of `#mode-hint`, and a button click. Left to a browser check.

## Scope change, 28 November 2026: the car is the only Subject (newest entry, kept at top)

- Decision (28 November 2026, by the User): the car is the only Subject. The walking figure and the abstract subject are dropped. Done while task 41.1 was open; not part of 41.1.
- Spec: `requirements.md` glossary Subject now reads "The moving thing being filmed. The car."; Requirements 14 and 15 carry a "Dropped on 28 November 2026" line under their titles (criteria unchanged, numbers kept). `design.md` RigSettings has `subjectKind: "car"`. `tasks.md` tasks 46 and 54 are marked DROPPED with a dropped line (sub-tasks and checkboxes unchanged).
- Code: `camera-rig.ts` `SubjectKind` is `'car'` (field `subjectKind` kept). `shot-measures.ts` comment above `SUBJECT_HALF_EXTENTS` now says only that the car is the only Subject.
- Tests: `samples-menu-rules.test.ts`: the `it.each` over car, figure, abstract is one `it` for 'car'; the no-mutation test passes 'car'. `camera-rig.test.ts`: "a subject kind change rebakes the subject" was removed. With one Subject kind a kind change cannot happen; "a Road change rebakes the subject" still covers a subject rebake.
- Not tested: nothing was run.

## Task 41.1: first-time hints (newest entry, kept at top)

- Done: new pure `src/view/hints-rules.ts` (`ANGLE_HINT_TEXT`, `MOVE_HINT_TEXT`, `HINT_DISMISS_LABEL`, `hintToShow(mode, seenAngle, seenMove)`, `hintTextForMode(mode)`, `hintStorageKey(mode)`) and `src/view/hints.ts` (`createHints(storage?)` returns `{ show(mode), dispose() }` or null; DOM). Approved wording, used verbatim (User, task 41.1): Angle mode hint "Angle mode: compare up to six cameras side by side. Click a camera view to make it the main camera."; Move mode hint "Move mode: shape how the main camera moves. Camera views are shown in Angle mode (key A)."; dismiss button "Got it". `index.html` has `<div id="mode-hint" role="note" hidden>` (text span and button) right after `#stage`, in the page flow, with no animation; `#term-hint` is untouched. `main.ts`: `createHints()` before `applyMode`, `hints.show(next)` inside `applyMode`, one `hints.show(mode)` at startup. Dismiss (button or Escape while shown) writes `hintSeenAngle` or `hintSeenMove` through `writeSetting` and keeps the flag in memory too. Switching mode without dismissing does not mark a hint seen. Escape is not in `key-map.ts`, so `keyboard.ts` is unaffected; the hint listener never calls `preventDefault`. No camera-rig.ts, src/logic or coverage-grid-rules.ts change.
- Not tested: nothing was run; no tests written (41.2); not opened in a browser (look, position, Escape, focus return to the main view after the button is used, screen-reader reading of `role="note"`).

## Task 40.2: sample loading tests (newest entry, kept at top)

- Done: new `test/view/samples-menu-rules.test.ts`, 9 `it` blocks (19 tests as Vitest counts them: 5 `it.each` tables expand 3 times each). Expected values are hand-written literals from the Samples table. Covers shape per sample, no `railShotWhenMain`, road copy, `subjectKind` pass-through, no input mutation (deep-frozen inputs), bake with `CameraRig` for each sample, a load from playing at frame 100 leaves the rig not playing, the exact loaded message, `STARTUP_SAMPLE_INDEX` and `SAMPLE_CAMERA_ID`. No src file changed.
- Not tested: nothing was run. "Frame 0 after load" and "starts at frame 0" live in `main.ts` (`timeline.seekTo(0)`) and the Timeline, which need the DOM; `CameraRig.bake` leaves the frame alone, so it is not asserted. Left to the 40.3 browser checkpoint.

## Task 40.1: sample shots loading (newest entry, kept at top)

- Done: new pure `src/view/samples-menu-rules.ts` (`sampleToSettings(sample, roadPoints, subjectKind)`, `sampleLoadedMessage(sample)`, `STARTUP_SAMPLE_INDEX` = 0, `SAMPLE_CAMERA_ID` = cam-1) and `src/view/samples-menu.ts` (`createSamplesMenu(container, { samples, initialIndex, onLoad })` returns `{ show(index) }`; a labelled native `<select>`, option titles from `SHOT_TYPE_TERMS`). `index.html` has `<div id="samples-box">` at the top of the controls column. `main.ts`: the app now starts with the first sample (orbit, one camera, `cam-1`, main), so the stop-gap two-camera startup list (push-in main plus orbit cam-2), `CAMERA_ID` and the `CAMERA_IDS` import were removed. Loading calls `applySettings(sampleToSettings(...), message)` (pause, re-bake, revert on failure, lens, grid, overview, readout, motion check) and then `timeline.seekTo(0)`, because `applySettings` keeps the old frame. New settings are built from the sample, so no camera has `railShotWhenMain`; the Road and subject in use are kept. No camera-rig.ts, src/logic or coverage-grid-rules.ts change. PathKit used only through the rig.
- Not tested: nothing was run; no tests written (40.2); not opened in a browser (menu look and keyboard use, re-selecting the same sample after editing, load from a playing state, status text).

## Task 39.2: motion check model tests (newest entry, kept at top)

- Done: new `test/logic/motion-check-model.test.ts`, 16 `it` blocks (29 tests as Vitest counts them, because 5 `it.each` tables expand). Expected texts are hand-written literals (finding wording from the design table, the no-problems message, the what-to-do line in one `WHAT_TO_DO` constant at the top of the file); no model constant is imported. Frames 10, 200 and 7 differ from the indices so a row index returned by mistake fails. No src file changed.
- Not tested: nothing was run; "Frame N" and the view (`motion-check.ts`) are not covered; no browser.

## Task 39.1: motion check list (newest entry, kept at top)

- Done: new pure `src/logic/motion-check-model.ts` (`buildMotionCheckRows`, `activateRow`, `motionCheckFailureOf`, constants) and `src/view/motion-check.ts` (`createMotionCheck(container, { onActivate })` returns `{ update(findings, failureMessage) }`; DOM). Rows use `describeFinding` and `NO_PROBLEMS_MESSAGE` from `findings.ts`; the error row is the only new wording (label "Error", a what-to-do line). The list sits below the readout (appended to `#readout-column` after `createReadout`). Each finding is a `<button>` (Enter and Space native) that calls `timeline.seekTo(frame)`. A warning has a text label and the amber `--warning` colour (new in `index.html`). `main.ts` updates the list at start, in `onSelect` and in `applySettings`, after `timeline.setShot`; never per frame. A failed motion check is detected from the successful outcome's `message` starting "the motion check could not run" (`camera-rig.ts` unchanged). `aria-live="polite"` is on the list; `update` skips the rebuild when the rows are the same. No src/logic existing file, camera-rig.ts or coverage-grid-rules.ts change.
- Not tested: nothing was run; no tests written (39.2); not opened in a browser (look, amber contrast, Enter and Space, focus after a re-bake, screen-reader announcement). A failed camera bake (`ok` false) keeps the previous list and shows the message in the status line only.

## Task 37.1b: remember a camera's rail shot, code only (newest entry, kept at top)

- Done (step 2): `CameraSetting.railShotWhenMain?: 'push-in' | 'crane'` in `camera-rig.ts` (the rig's bake path reads named fields only, so it ignores it). `planMainChange` sets it to the OLD type on conversion, and on the new main camera restores the shot type and drops the key; message order is conversion sentences, "Only the main camera can be a rail shot.", then "<id> is back to <type>." (restore only: just that sentence). `withShotType` sets it to the requested type on a non-main conversion and removes it when the Main_Camera's type is set; `withAddedCamera` does not copy it. `controls.ts` row text is "cam-1, orbit (push-in when main) " (the existing trailing space is kept), updated in place in `fillRow`. 
- Done (step 1): the existing test "keeps bearing, height, distance and lens of a converted camera" now expects `railShotWhenMain: 'push-in'` in its toEqual.
- Done (step 2): `withShotType` rule changed. Orbit or tracking on ANY camera removes `railShotWhenMain` (key absent); only a non-main rail request (converted to orbit) sets it, to the requested type; the Main_Camera set to push-in or crane leaves it as it is. Sentence added to requirements.md (7.5), design.md ("Remembered rail shot") and this task's line in tasks.md.
- Done (step 3): 5 new `it` blocks in `describe('planMainChange remembered rail shot')` in `test/view/coverage-grid-rules.test.ts` (remember, restore, crane among four cameras, orbit/tracking get no key, input unchanged and chained calls). Hand-written values. Expected for that file: 23 blocks, 64 reported.
- Not tested: nothing was run. `withShotType` has no test in this task (the new rule is untested); no browser check.

## Task 38.1: readout (newest entry, kept at top)

- Done: new `src/view/readout.ts` (`createReadout(container)` returns `{ show(rig, cameraId, lensMm, displayedFrame) }`; DOM), pure `src/view/readout-rules.ts` (decimals constants, `valueKey`, text formatters, `FIELD_OF_VIEW_TITLE`, row labels, `cutoffLine`, `sourceLine`) and pure `src/view/shot-measures.ts` (`measureShot`, `createShotMeasures`, `SUBJECT_HALF_EXTENTS`). Shared calculation moved: the elevation, Angle_Label, fill and Framing_Label code (and the box half extents and the two scratch arrays) that was private inside `drawTile` in `coverage-grid.ts` now lives in `measureShot`; `drawTile` and the Readout both call it, so they agree. `coverage-grid.ts` otherwise unchanged (imports trimmed). `main.ts`: `readout` and `mainLensMm` variables, `showAt` calls `readout.show` on every displayed frame, `applyMainLens` calls it (frame clamped to the shot length, because `timeline.setShot` runs after it in `onSelect` and `applySettings`), and one first call after the Timeline is made. `index.html` unchanged (`#readout-column` already existed). Wording: all from `term-text.ts` (ANGLE_TERMS, FRAMING_TERMS, MEASURE_TERMS, CUTOFF_NOTE, angleCutoffText, framingCutoffText, ANGLE_NOTES unchanged); only plain labels, "Cut-off: ", "Source: " and units are new. Findings are not in the readout (Timeline marks them; task 39 lists them). No aria-live. No src/logic, camera-rig.ts or coverage-grid-rules.ts change. PathKit used only through the rig.
- Not tested: nothing was run; no tests written (none asked for); not opened in a browser (look, hover and focus lines, the note for each angle, update while playing, lens change, main camera change, re-bake with a shorter shot).

## Task 37.1a: Camera views in Move mode (newest entry, kept at top)

- Done, user-requested. Specs: Requirement 7.1 now also says the pictures are hidden in Move mode with the line 'Camera views are shown in Angle mode (key A).' and drawn again in Angle mode (appended to 7.1, not a new criterion, because tasks.md cites 7.2 to 7.12); one paragraph added to `design.md` Rendering layer; new unchecked task 37.1a. Code: `CoverageGrid.setVisible(boolean)` in `coverage-grid.ts` (sets the container's inline `display` to `grid` or `none`; tiles stay in the DOM); `index.html` has `<p id="grid-move-message" class="empty-message" hidden>` under `#grid`; `main.ts` has the constant `GRID_MOVE_MESSAGE` and `applyMode` now calls `grid.setVisible`, toggles the message and redraws with `changed = true` (the draw happens in Angle mode only, through `shouldRenderGrid`). The message is not a live region: `#status` (`role="status"`) already announces the mode change. No coverage-grid-rules.ts, camera-rig.ts or src/logic change.
- Not tested: nothing was run; not opened in a browser (hide and show, redraw on return to Angle mode, tiles rebuilt while hidden, focus after the switch).

## Task 37.1 fix: first camera click lost after typing in a number field (newest entry, kept at top)

- Done, user-requested, `src/view/controls.ts` only (`controls-rules.ts` not touched). Cause: leaving a number field fires `change`, `show()` rebuilt the camera rows, and the click landed on a button that no longer existed. Now `show()` keeps the built rows (`rowParts`) and, when the camera id list has the same length and the same ids in the same order, updates them in place (select text, `aria-pressed`, `title`, `data-select`, key hint; Remove `data-remove`, `title`, `aria-label`, `hidden`). It rebuilds only when a camera was added, removed or reordered. Every row now has a Remove button; the main row's is hidden with `hidden`, so no rebuild is needed when the main camera changes. Each Remove button has `aria-label` "Remove <id>" (the title is unchanged). Focus: in place, the element is the same so focus stays; on rebuild, the existing restore by `data-select` id is kept. No other control or file changed.
- Not tested: nothing was run; not opened in a browser (the click-after-typing case, focus after Enter, the hidden Remove button on the main row, screen-reader name).

## Task 37.2: keyboard wiring (newest entry, kept at top)

- Done: new `src/view/keyboard.ts` (`createKeyboard(options)`, one `keydown` listener on the document; every key goes through `actionForKey`, no second key table) and pure `src/view/keyboard-rules.ts` (`focusInTextField`, `nativeKeyConflict`, `isHandledHere`, `allowsRepeat`, `slotIndexOf`, `nextLensPreset`, `nextShotType`). `timeline.ts` (additive): `lastFrame()`, `togglePlay()`, `seekTo(frame)`; the Play button and the scrub slider now call the same inner functions, behaviour unchanged. `main.ts`: new `applyMode` (the mode buttons and the A/M keys), `createKeyboard` call with handlers for slots (through `onSelect`), lens cycle and zoom (through `applyMainLens`, no re-bake), shot-type cycle (through `withShotType` and `applySettings`, which pauses first). No src/logic, camera-rig.ts, coverage-grid-rules.ts or guides-view.ts change. PathKit not used.
- Choices, mine: T and G stay in `guides-view.ts` (least change); keyboard.ts ignores those two actions and does not call preventDefault for them. capture-frame and open-about do nothing (tasks 45 and 42). Keys with Ctrl, Meta or Alt, or already `defaultPrevented`, are skipped. Held keys repeat for step-back, step-forward, zoom-in, zoom-out only; for other handled keys a repeat is swallowed with preventDefault and does nothing. `<select>` counts as a text field (letters, digits, arrows, Home, End pick options), so no app key works while a select has focus. Range sliders are not text fields: Left, Right, Home, End are left to the slider; other keys, including Space, still work there. On a button, checkbox or radio only Space is left to the browser (it clicks the control); arrows, Home and End have no native action there, so the app uses them. Stepping and first/last frame pause (as scrubbing does), so they never start playback. Slot with no camera: status line message, nothing else. Shot-type cycle follows the menu order (push-in, orbit, tracking, crane) and uses the main camera only.
- Not tested: nothing was run; no tests written (none asked for); not opened in a browser (real key events, focus cases, repeat feel, page scroll on Space).

## Task 37.1: controls panel (newest entry, kept at top)

- Done: new `src/view/controls.ts` (`createControls(options)` returns `{ show, setLens, setMode }`; DOM) and pure `src/view/controls-rules.ts` (field checks, new-settings builders, key text; no DOM, testable). `main.ts`: `MODE` const became `let mode`, new `applySettings(next, message)` (pause, `rig.setSettings` + `rig.tick`, restore on failure, then `grid.setLayout`, `timeline.setShot`, `applyMainLens`, view, subject, overview, `controls.show`), `controls` created after the first draw, lens preset options get `LENS_TERMS` titles, `onSelect` and `applyMainLens` call `controls.show` / `controls.setLens`. `index.html`: `#controls-top`, `#lens-field`, `#controls-after-lens`, a few CSS rules. No camera-rig.ts, src/logic or coverage-grid-rules.ts change. PathKit used only through the rig.
- Choices, mine: edits apply to the Main_Camera; to edit another camera, select it in the list (this makes it main, as a tile click does). So Shot_Type is only ever set on the Main_Camera (Requirement 8.1) and no non-main camera can become a rail shot from the controls; `withShotType` still converts a non-main push-in or crane to orbit with a status message (Requirement 7.5) as a guard. A new camera copies the Main_Camera's placement and lens as an orbit shot (no spec default exists). Remove buttons exist for non-main cameras because CAMERA_LIMIT_MESSAGE tells the User to remove one. Bearing has no range (design: bearing wraps), only "finite number". Shot_Type is not disabled in Angle mode. Move mode only sets `mode`; the grid stops redrawing, so its tiles keep the last Angle-mode image.
- Controls without a Term_Text line (plain label only, no tooltip): mode tabs, camera list and Add/Remove buttons, Shot_Type select (its options and the current choice do have `SHOT_TYPE_TERMS` lines), Shot_Length. Number fields have no key in the key map, so they show "(Up/Down)".
- Not tested: nothing was run; no tests written (none asked for); not opened in a browser.

## Task 36.1 change: Timeline directly below the main view (newest entry, kept at top)

- Done, user-requested, in three steps. Step 1 (cleanup of the cancelled "Layout that fits one screen" prompt): Requirement 17 has 10 criteria, no 17.11 to 17.14; `design.md` has no "Layout at different sizes"; `tasks.md` has no 36.1a; no references to those remained. Nothing removed. Step 2 (specs): Requirement 17.5 now reads "THE Shot_Rail_App SHALL show the Timeline directly below the main camera view."; task 36.1's text changed from "at the bottom" to "directly below the main camera view" (`design.md` had no "at the bottom"); new unchecked task 36.3 "Revisit the layout when every region exists" after 36.2. No checkbox changed. Step 3 (`index.html` only): `#timeline-region` (with `#timeline`) moved inside `#main-column` right after `#stage`; order is `#stage`, `#timeline-region`, `#status`, `#term-hint`, `#side-views`. Removed the full-width "timeline" grid row (`grid-template-areas` is now one row, `"controls main readout"`) and the `grid-area: timeline` rule (replaced by `margin-top: var(--gap)`); in the 900 px block the `"timeline"` area line was removed, so the timeline follows the main view inside `#main-column`. No other file changed; `main.ts` and `layout-rules.ts` only look elements up by id.
- Not tested: no commands were run. The page has not been opened in a browser; whether the main view still leaves room for the timeline (`--main-height-offset` is unchanged at 280px) is unchecked.

## Task 36.1: interface layout (newest entry, kept at top)

- Done: rewrote `index.html` as a CSS grid: Controls column (left), main view column (centre: `#stage`, `#status`, hint line, then the Stage overview and Camera views), Readout column (right), Timeline (bottom, full width). Wrote `src/view/layout.ts` (`applyLayout()`, `setRegionEmpty(id, empty)`) and pure `src/view/layout-rules.ts` (`TERM_BINDINGS`, `EMPTY_REGIONS`, `HINT_PLACEHOLDER`, `hintTextFor`). `main.ts`: imports `applyLayout` and `MEASURE_TERMS`, calls `applyLayout()` first, and passes `MEASURE_TERMS.thirdsGuide.text` and `MEASURE_TERMS.safeAreaGuide.text` as the guide tooltips (they were hand-written strings). No camera-rig.ts, src/logic or other view file changed. PathKit not used.
- Choices: explanations on hover are `title`; on keyboard focus one visible hint line (`#term-hint`) copies the focused element's title. Colours and sizes are CSS custom properties in `index.html`. Narrow breakpoint 900px is my own value. `#stage` got `tabindex="0"` so the wheel-zoom line can be reached by keyboard.
- Not tested: the layout has not been opened in a browser; the new files have not been type-checked or built; no tests were written (none asked for).

## Task 35.2: key map tests (newest entry, kept at top)

- Done: wrote `test/logic/key-map.test.ts` (9 `it` blocks, 61 Vitest tests expected: 21 table keys + 7 upper-case + 1 for `=` + 6 unknown keys + 22 text-field keys (21 plus `=`) + 1 for "a"/"1" in a field + 1 PRIMARY_KEYS + 1 KEY_ACTIONS + 1 KEY_ALIASES). The key table and the count 21 are hand-written literals. Imports only `key-map.js` and `vitest`. No src change. PathKit not used.
- Not tested: the tests have not been run; the page wiring (task 37.2), real key events in a browser.

## Task 35.1: key map (newest entry, kept at top)

- Done: wrote pure `src/logic/key-map.ts`. Exports `KeyAction`, `PrimaryKey`, `PRIMARY_KEYS`, `KEY_ACTIONS`, `KEY_ALIASES`, `actionForKey(key, focusInTextField)`. No imports, no existing file changed. Slot actions are neutral (`select-slot-1` to `select-slot-6`). PathKit not used.
- Not tested: no tests yet (task 35.2); not wired to the page (task 37.2).

## Task 34.3: lens zoom by wheel (newest entry, kept at top)

- Done, user-requested, in three steps. Step 1 (specs): `design.md` Named constants table has four new rows (`LENS_ZOOM_MIN_MM` 24, `LENS_ZOOM_MAX_MM` 85, `LENS_WHEEL_STEP_RATIO` 1.05, `LENS_KEY_STEP_RATIO` 1.1); `tasks.md` 35.1 now says "Each action has exactly one primary key (= is an alias of +)". No checkbox changed. Step 2: added the four constants to `src/logic/constants.ts`; new pure `src/logic/lens-zoom.ts` (`stepLens`, `lensAfterWheel`, `presetOf`); new `test/logic/lens-zoom.test.ts` (10 `it` blocks, no `it.each`); `MEASURE_TERMS.lensZoom` added to `src/logic/term-text.ts`, and the count test in `test/logic/term-text.test.ts` is now 4 + 3 + 4 + 4 + 12 + 3 = 30 lines. Step 3: `CoverageGrid.setLensMm(id, lensMm)` in `src/view/coverage-grid.ts` (tile `lensMm` and `verticalFovRad` are now mutable and changed in place; unknown id or a bad lens does nothing); in `src/main.ts` one `applyMainLens(mm)` (view lens, new camera object in `current.cameras`, grid tile and one grid render, lens menu) used by the menu change handler and by `onSelect`; one non-passive `wheel` listener on `#stage`.
- build-notes count mentions: the only "11" near term text is "11 `it` blocks" for the test file in the "Text pack" entry (an `it` count, unchanged, still true); no entry states the MEASURE_TERMS count or the 29 line count, so nothing was edited.
- Open choices, mine: wheel up (deltaY below 0) zooms in. Wheel steps are 5 percent, no rounding, so the lens is usually between presets; the menu then shows a disabled "Custom (N mm)" option. The wheel changes no frame and does not pause playback; the grid is redrawn with `changed` true on each wheel event, even while playing. `applyMainLens` does not call `rig.setSettings` and does not re-bake. In `onSelect`, `applyMainLens` runs before `grid.setMain` and before the final grid render, so the grid draws twice on a camera swap.
- Stale lens risk: the rig keeps its own copy of the settings (`pending`) with the lens from the last `setSettings`. The bake only copies `lensMm` into the placement. Anything that re-bakes from the rig's own settings (not from `current`) would use the old lens. Today `onSelect` builds `next` from `current`, so it keeps the zoomed lens. The overview does not read a lens (`stage-overview.ts` and `stage-overview-framing.ts` have no `lens` mention). Future code that edits settings must start from `current`.
- Broke: nothing known. Not run by Kiro.
- Not tested: everything, including the new tests, the wheel in a browser (page scroll prevented, trackpad feel), the custom menu option, the grid tile's framing label after zoom, wheel while playing.

## Task 34.1: Timeline UI (newest entry, kept at top)

- Done: wrote `src/view/timeline.ts` (`createTimeline(container, { rig, shotLengthFrames, findings, onChange })` returns `{ frame(), isPlaying(), pause(), setShot(shotLength, findings), dispose() }`) and pure `src/view/timeline-rules.ts` (`lastFrameOf`, `buildFrameCounterTexts`, `findingMarkFrames`, `findingMarkFraction`, `findingMarksSummary`, `NO_FINDING_MARKS_TEXT`). All play, pause, seek and step logic is the existing `playback.ts` (`initialPlaybackState`, `playPlayback`, `pausePlayback`, `seekPlayback`, `stepPlayback`) and `scrubToFrame`; none duplicated. No camera-rig.ts, playback.ts or src/logic change. PathKit used only through the rig (`findingsForMain`, `evaluate`, `evaluateSubject`).
- Added to existing files: `index.html` got a `#timeline` rule (same width as the stage) and one `<div id="timeline" role="group" aria-label=...>` between `#stage` and `#bar`. `main.ts`: removed `DISPLAYED_FRAME`; new imports; `#timeline` is now required (the start-up check throws if it is missing); new `showAt(tick)` draws the main view, the car, the overview and the grid at the Timeline's frame; `createTimeline` after the first bake; `onSelect` now calls `timeline.pause()` before the re-bake and `timeline.setShot(...)` after it; the other draw calls use `timeline.frame()`. Nothing added to the other view files.
- One animation-frame loop (`loop`, created once), started only by the Play button, stopped on pause, scrub, `setShot` or the last frame. The clock is read only here: the rAF timestamp in the loop and `performance.now()` for button and scrub events. The first loop step after play uses elapsed 0, so no clock mixing. The pure API forces one small `PlaybackState` object per loop step (`stepPlayback` returns a new one); nothing else is made per frame (tick object, counter texts, loop function reused). `slider.valueAsNumber` is used so no string is built per frame.
- Open choices, mine (named local constants or behaviour): one toggle button, "Play" / "Pause" (a disabled Pause button would lose keyboard focus); scrubbing while playing pauses playback (`pausePlayback(seekPlayback(...))`), so the slider is not fought by the loop; a non-finite scrub value is ignored (design error table); `THUMB_WIDTH_PX = 16` (marks are inset 8 px each end to line up with the slider thumb, approximate, differs by browser); `MARK_WIDTH_PX = 3`, `MARK_HEIGHT_PX = 12`, `MARK_COLOUR = '#c0392b'`, `ROW_GAP_PX = 12`; counter text "Frame N of LAST (S.SS s)"; marks are deduplicated and clamped to the shot, with a text summary line ("Findings at frames ...", or a message saying what a mark is when there are none) so colour is not the only cue; if drawing throws inside the loop, the error is logged and that frame is skipped (design error table). `gridChanged` is true for every change except a plain loop step, and for the step that stops playback, so the grid draws the last frame.
- Events in `main.ts` that leave playback paused: start (initial state), selecting a new Main_Camera in `onSelect` (paused before the re-bake, `setShot` pauses again, the failed-bake restore also runs after the pause). The lens menu changes no bake and does not touch playback. Events the app does not have yet: load sample, change mode, change Shot_Type, change Subject, change Shot_Length, edit Road, keyboard step (task 35). Each must call `timeline.pause()` / `timeline.setShot()` when added.
- Deferred: key shown beside each control (Req 11.12, 18.2) needs the key map of task 35; for now the tooltips say Tab then Space or Enter on the button, and the slider's native Left, Right, Home and End.
- Broke: nothing known. Not run by Kiro; no tests written (the task asks for none; `timeline-rules.ts` is pure and can be tested later).
- Not tested: look, real browser, play speed against a clock, rAF behaviour in a background tab, scrub feel, mark alignment, keyboard use of the controls, WebGL output, whether the car speeds up and slows down (30.2), whether markers and rail move in the overview (31.2).

## Task 33.2: playback tests (newest entry, kept at top)

- Done: wrote `test/logic/playback.test.ts` (28 `it` blocks, 55 Vitest tests expected: 21 plain blocks plus `it.each` expansions of 2 + 7 + 4 + 9 + 3 + 4 + 5). Expected values are hand-written literals with the working in comments (30 fps, 1 frame = 33.333 ms; cap written as the literal 5). Only imports from `playback.ts` and `vitest`. No src change. No fast-check (the shot-rail rules forbid it). PathKit not used.
- Open choice, mine: the task's "events that must not start playback" table covers only the events this pure module owns (start, pause, scrub, keyboard step, step while paused). Load sample, change mode, Shot_Type, Subject, Shot_Length and re-bake are not in `playback.ts`; they belong to the view and main code and cannot be tested here.
- Broke: nothing known. Not run by Kiro.
- Not tested: the view events listed above, the timeline UI (task 34), real timing from a clock.

## Task 33.1: playback stepping (newest entry, kept at top)

- Done: wrote pure `src/logic/playback.ts` (imports `FRAME_RATE` and `PLAYBACK_MAX_CATCHUP_FRAMES` from `constants.ts`). Exports `PlaybackState`, `PLAYBACK_FRAME_EPSILON`, `initialPlaybackState()`, `playPlayback(state, lastFrame)`, `pausePlayback(state)`, `seekPlayback(state, frame, lastFrame)`, `stepPlayback(state, elapsedMs, lastFrame)`. No existing src/logic file changed. PathKit not used.
- Open choices, mine: `PLAYBACK_FRAME_EPSILON = 1e-9` (so 100 ms gives exactly 3 frames, not 2); frames are counted as `floor(ms * FRAME_RATE / 1000 + epsilon)`; `playPlayback` at the last frame restarts from frame 0; `seekPlayback` keeps `playing` as it was and clears the accumulator; `pausePlayback` clears the accumulator; over the catch-up cap the accumulator is set to 0 (backlog dropped); reaching the last frame sets `playing` false and the accumulator to 0; a negative or non-finite `elapsedMs`, or a `lastFrame` that is not a whole number >= 0, throws an Error naming the value.
- Not tested: no tests yet (task 33.2).

## Task 32.3a: Main_Camera swap rule (newest entry, kept at top)

- Done, user-requested, in three steps. Step 1 (specs): Requirement 7.5 now says that clicking a Camera view makes it the Main_Camera and that any other push-in or crane Camera becomes an orbit shot (bearing, height, Horizontal_Distance and lens kept) with a status-line message; `tasks.md` has a new sub-task 32.3a between 32.3 and 32.4, and 32.4 has a new check (click tile 2). No checkbox changed. Step 2: added pure `planMainChange(cameras, newMainId)` and the `MainChange` type to `src/view/coverage-grid-rules.ts` (new import: `type ShotType` from `../logic/shot-builders.js`) and 9 `it` blocks to `test/view/coverage-grid-rules.test.ts` (file now 18 `it` blocks, 59 Vitest tests expected). Step 3: in `src/main.ts`, `onSelect` no longer refuses with "cannot be the main camera yet"; it calls `planMainChange`, builds `next` with `cameras: plan.cameras`, and sets the status line to `plan.message` on success. The rig revert-on-failure code is unchanged.
- Broke: nothing known. Nothing was run by Kiro.
- Not tested: the new tests, the browser behaviour, the status line on screen.

## Task 32.3: Coverage_Grid view (newest entry, kept at top)

- Done: wrote `src/view/coverage-grid.ts` (`createCoverageGrid(container, auxRenderer, roadPoints, onSelect)` returns `{ setLayout(settings), setMain(id), render(rig, frame, mode, changed, playing, msSinceLast), dispose() }`). One tile per camera: a `<button>` holding a 2D canvas (160x90 CSS px, times the pixel ratio capped at 2) and a caption with the camera id, the Angle_Label, the Framing_Label and a "Main" tag on the main tile (teal border plus the tag, so colour is not the only cue). Each tile is drawn by the shared auxiliary renderer and copied with `drawImage` straight after its render. `render` asks `shouldRenderGrid` and draws nothing outside Angle mode. A click or Enter (a button turns Enter and Space into a click, so there is no key handler) calls `onSelect(selectMain(id))`. No camera-rig.ts, coverage-grid-rules.ts or src/logic change. PathKit used only through the rig (`rig.evaluate`, `rig.evaluateSubject`) and `framingPercent` from `fill.ts`.
- Added to existing files: `index.html` got one `<div id="grid">` after `#overview`. `main.ts` got imports, a `MODE = 'angle'` constant, the shared aux renderer now serving both the overview and the grid, the grid creation, and an `onSelect` handler (see next point). Nothing was added to `main-view.ts` or `stage-overview.ts`. The camera list in `main.ts` is unchanged (cam-1 push-in, cam-2 orbit).
- Rail rule: `buildSceneSet` allows a rail shot only on the main camera. `onSelect` in `main.ts` therefore refuses, with a status message and without touching the rig, any change of main while another camera is a push-in or crane. If it did pass, a failed bake is rolled back (the old settings are set again). With the current list, clicking cam-2 is always refused (cam-1 is the push-in), and clicking cam-1 does nothing (it is already main). The success path (new main, overview and lens menu follow) is written but cannot be reached until task 35 lets the User change a camera's shot type.
- Open API shape, my choices: Angle_Label elevation is `atan2(camera y - subject y, horizontal distance)` from the evaluated positions at the shown frame (design Elevation). Framing uses the car's box (`CAR_HALF_EXTENT_*`) for every subject kind, since only the car exists. Local constants in `coverage-grid.ts`: near 0.1, far 1000, background 0x20242a, ground grid 200 m / 100 divisions (as in the main view), gap 8 px, 3 columns, border 3 px, border colours #4a515c and main #2ee6c4, caption colours #f2f2f2 on #14171b, caption font 12 px system stack. The grid has its own `createSubjectView` (a Three.js object can have one parent, so it cannot share the main view's). No per-frame allocation: label text is only assigned when it changes and is always an existing string.
- Broke: nothing known. Not run by Kiro; no editor diagnostics were visible to Kiro.
- Not tested: look, WebGL output, real browser, whether the labels are right on screen, click and Enter on a tile, the refused-selection message, two WebGL contexts plus the overview sharing one renderer, resize and pixel-ratio changes, contrast on screen, PNG download, dev server. No tests were written (the task asks for none; the view loads Three.js).

## Task 32.2: Coverage_Grid rules tests (newest entry, kept at top)
- Done: wrote `test/view/coverage-grid-rules.test.ts` (9 `it` blocks, 50 Vitest tests: the 32-row table via `it.each`, 6 `addCamera` counts via `it.each`, 6 `selectMain` ids via `it.each`). Expected values are hand-written literals (interval 100 = 1000 / 10, limit 6, message contains "At most 6"). No src change. PathKit not used.
- Broke: nothing known. Not run by Kiro.
- Not tested: look, WebGL output, real browser, the grid view (task 32.3), click and Enter handling on tiles.

## Task 32.1: Coverage_Grid rules (newest entry, kept at top)
- Done: wrote pure `src/view/coverage-grid-rules.ts` (`shouldRenderGrid`, `addCamera`, `selectMain`; imports only `MAX_CAMERAS` and `PLAYBACK_RATE_GRID` from `constants.ts`). No camera-rig.ts or src/logic change. PathKit not used.
- Open API shape, my choice: `GridMode = 'angle' | 'move'` is defined locally (no mode type existed). `GRID_REFRESH_INTERVAL_MS = 1000 / PLAYBACK_RATE_GRID` (100). `addCamera(count)` returns `{ ok, count, message? }` and never mutates; the message is `CAMERA_LIMIT_MESSAGE` and contains the limit 6 from `MAX_CAMERAS`. `selectMain(id)` returns `id` unchanged (no id validation).
- Broke: nothing known. Not run by Kiro.
- Not tested: no tests yet (task 32.2).

## Text pack: Term_Text module, sources table, cut-off wording (newest entry, kept at top)
- Done: applied `docs/shot-rail-text-pack.md`. Created `src/logic/term-text.ts` (section 2) and `test/logic/term-text.test.ts` (section 3, 11 `it` blocks) character for character. Replaced the table in `docs/sources.md` with the section 4 table (an Id column added; heading and sentence kept). Added a "Facts and sources" section to `THIRD_PARTY.md`. Spec wording edits: "commonly used" became "this app's own cut-offs" in `requirements.md` (Requirement 5 criterion 6 and Requirement 6 criterion 5), `tasks.md` (Task 38.1 only) and `brief.md` (line 103). Requirement 5.8 and Task 38.2 unchanged. No task status changed.
- Broke: nothing known. Not run by Kiro.
- Not tested: the new test file has not been run.

## Task 31.1 fix pack: main.ts cameras and framing test (newest entry, kept at top)
- Done: applied `docs/task-31-1-fix-pack.md`. In `src/main.ts`, `sample` stays `SAMPLE_SHOTS[1]` (the push-in), and the comment and `cameras:` list in `settings` are now the exact block from section 2 (cam-1 from `sample`, cam-2 from `SAMPLE_SHOTS[0]`, the orbit). `CAMERA_ID` is still `'cam-1'`, equal to `CAMERA_IDS[0]`. Created `test/view/stage-overview-framing.test.ts` from section 3, character for character (15 `it` blocks: 9 for `computeTopDownFraming`, 6 for `extendRailEnd`).
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet.
- Not tested: the new test file has not been run; the browser check (task 31.2) is not done.

## Task 31.1 fix: camera list in main.ts (newest entry, kept at top)
- Done: in `src/main.ts` the camera list is now two cameras: cam-1 is `SAMPLE_SHOTS[1]` (the push-in, the main camera) and cam-2 is `SAMPLE_SHOTS[0]` (the orbit). `sample` is now `SAMPLE_SHOTS[1]`, so the shot length and the initial lens menu value follow the push-in. The crane is no longer in the list. The file header comment now says "push-in sample shot".
- Why: the earlier three-camera list put the push-in on cam-2. `buildSceneSet` refuses any rail shot (push-in or crane) that is not the main camera, because one scene has one path. Only the main camera may be a rail shot, so the push-in must be cam-1, and the crane has to stay out for the same reason.
- Remove the temporary list when the camera list (task 35) takes over. Not run by Kiro.

## Task 31.1: Stage_Overview (newest entry, kept at top)
- Done: wrote `src/view/stage-overview.ts` (`createStageOverview(container, auxRenderer, roadPoints)` returns `{ canvas, setLayout(rig, settings), showFrame(rig, frame), dispose() }`): an orthographic top-down camera (north up, +X right) over a scene holding its own `createSubjectView` (car and road), one cone marker per camera that points along the camera's forward axis (main camera teal, others light grey), and a blue line for each push-in or crane rail. After `render` the image is copied into the view's own 2D canvas with `drawImage`, in the same call. Wrote pure `src/view/stage-overview-framing.ts` (`computeTopDownFraming` and `extendRailEnd`, no Three.js or DOM) and `src/view/aux-renderer.ts` (`createAuxRenderer`, the shared auxiliary renderer, pixel ratio 1; it did not exist yet and the design names it). Uses PathKit only through the rig (`rig.evaluate`, `rig.evaluateSubject`).
- Open API shape, my choice: rail ends come from the baked camera at frame 0 and frame N-1, then `extendRailEnd` adds the last 1/N, because a rail camera has covered (N-1)/N of its rail by frame N-1 and the baked data does not expose the rail path. The framing holds the road control points, the camera positions at up to 9 frames along the shot and the rail ends, plus a 10% margin. Local constants in `stage-overview.ts`: aspect 1, margin 0.1, minimum half height 10 m, 9 samples, camera height 300 m, near 1, far 700, marker length 5% of the view height, marker radius 0.35 (of its length), colours 0x20242a background, 0x2ee6c4 main marker, 0xe8e8e8 other markers, 0x6fa8ff rails; markers and rails are drawn with depth test off so the road never hides them.
- Edited existing files (additive): `index.html` (a 240 x 240 `#overview` box and its style); `main.ts` (builds the aux renderer and the overview, calls `setLayout` then `showFrame` at frame 0; `cameras` now holds the first three sample shots as `cam-1`, `cam-2`, `cam-3`, so the push-in and crane rails show; `cam-1` is still the main camera). No change to `camera-rig.ts`, `main-view.ts`, `subject-view.ts` or any `src/logic` file.
- Broke: nothing known. Not built or run by Kiro.
- Kiro got wrong: nothing known yet.
- Not tested: look, WebGL output, real browser, whether the markers and rails land in the right places, resize behaviour, two WebGL contexts at once, PNG download, feel of controls, dev server. No tests were written (the task asks for none). The pure framing functions have no test yet.

## Task 30.2: user checkpoint, view the car on the road (newest entry, kept at top)
- Done: the user viewed the built app (from `npm.cmd run build` after task 30.1) in a browser at frame 0 and confirmed all four checks: (1) the car sits on the road surface, neither floating nor sunk in; (2) at frame 0 the car faces along the road, with the yellow front bar at the front; (3) the car is boxes and cylinders only, with no brand, logo or plate text; (4) the road shows no flicker or z-fighting against the grid. No code changed.
- Deferred by the user's choice: scrubbing through frames, and the speed-up and slow-down along a lap. The app shows only frame 0 until the Timeline (task 34.1), so these are to be checked at the 34.2 checkpoint.
- Broke: nothing known.
- Kiro got wrong: nothing known.
- Not tested: the car while moving, other subjects.

## Task 30.1: car and road drawing (newest entry, kept at top)
- Done: wrote `src/view/subject-view.ts` (`createSubjectView(roadPoints)`: car from 3 boxes, 4 cylinder wheels and a yellow front bar, parts in an inner group lowered by `SUBJECT_CENTRE_HEIGHT` inside an outer group whose origin is the box centre; road ribbon and `LineLoop` centre line from `createCurve` + `createArcLengthTable` at `ROAD_DRAW_SAMPLES` equal arc-length steps, lowered by `SUBJECT_CENTRE_HEIGHT` and lifted by `ROAD_LIFT_M` (0.02) and `ROAD_LINE_LIFT_M` (0.02) against z-fighting with the grid; `setRoad` rebuilds only when the points change and keeps the old road if the new one throws; `showFrame(rig, frame)` copies `rig.evaluateSubject` into the car group with one preallocated `OutBuffer`). User-approved additions: `CameraRig.evaluateSubject(displayedFrame, out)` in `camera-rig.ts` (same file-private `remap`, the rig's `subjectBaked`, returns `out`, throws "the subject has not been baked yet" before the first bake; the only existing code touched is one line in `bake()` that records the shot length) and `addObject(object)` in `main-view.ts` (adds to the scene, no render request). `main.ts` shows the car at displayed frame 0. Wrote `test/view/camera-rig-subject.test.ts` (9 `it` blocks, 9 Vitest tests). Not run by Kiro.
- Open API shape, my choice: `evaluateSubject` throws (not null) before the first bake so the return type matches `evaluate()`. `evaluateSubject` range-checks the frame against the shot length of the last good bake (a private `bakedShotLength`, set in `bake()` when a bake is committed): a frame that is not a whole number in [0, shot length - 1] (-1, 1.5, NaN, Infinity, the shot length) throws the same message as `evaluate()` ("Frame N is outside the valid range [0, L-1]"), before the remap, and leaves `out` untouched. Road width 6 m, colours and car part sizes are local constants in `subject-view.ts`.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet. The frame 120 hand value (-22, 0.7, 0) only holds to a few millimetres (the arc-length table has 1023 chord steps), so the test bound is 0.01 m, with the exact check against a solo bake.
- PathKit features used: `createCurve`, `createArcLengthTable` (road drawing), `evaluateEntity` (car pose), `followPath` baked subject.
- Not tested: look, WebGL output, real browser, whether the car sits on the road and faces forward on screen, z-fighting, PNG download, feel of controls, dev server, `setRoad` and `dispose` (no caller yet).

## Task 29.5: guides tests (newest entry, kept at top)
- Done: wrote `test/logic/guides.test.ts` (17 `it` blocks, 23 Vitest tests; `it.each` over 2 keys and 6 stored texts). Imports only `guides.ts` and the `StorageLike` type, not `guides-view.ts`. Hand values: thirds of 1600x900 (533.333, 1066.667, 300, 600) and 1920x1080 (640, 1280, 360, 720); safe area 1600x900 at 0.9 and 1920x1080 at 0.93 (67.2, 37.8, 1785.6, 1004.4), with explicit tolerances; fraction 1 is the whole frame. Toggle with a mock storage: flips, writes `shot-rail:<key>` as `true` or `false`, one key only, throwing `setItem` and null storage still toggle, round trip. Load: missing, `false`, bad JSON, `1`, `"true"`, `null`, empty text, throwing `getItem` and null storage all give false. No src change. Not run by Kiro.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit features used: none.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server, the T and G keys, the overlay drawing.

## Task 29.4: guides (newest entry, kept at top)
- Done: wrote pure `src/logic/guides.ts` (`thirdsLines`, `safeAreaRect`, `loadGuideState`, `toggleGuide`; no Three.js or DOM imports) and `src/view/guides-view.ts` (`createGuidesOverlay`: a 2D canvas over the stage, redrawn only on toggle or resize, two-pass dark and light strokes; `createGuideToggle`: labelled checkbox with tooltip; keys T and G, ignored while typing in a select or text field). Safe area uses `SAFE_AREA_FRACTION`. State is stored as `thirdsGuideOn` and `safeAreaGuideOn` through `readSetting`/`writeSetting`. Edited `src/main.ts` and `index.html` (a `#guides` span in the bar). Not run by Kiro.
- Open API shape, my choice: `toggleGuide(current, key, storage?)` returns the new state and stores it, so 29.5 can test toggling with a mock storage. `thirdsLines` returns `{ vertical: [x1, x2], horizontal: [y1, y2] }`; `safeAreaRect` returns `{ x, y, width, height }`. Overlay is sized from the container width and 16:9, like the main view. Colours and line widths are local constants in `guides-view.ts`.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet. Assumes the stage box has width set by CSS so `clientWidth` is positive, and that `position: relative` on the stage does not disturb the main view.
- PathKit features used: none (guides do not use PathKit).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 29.1: main-view.ts and index.html (newest entry, kept at top)
- Done: wrote `src/view/main-view.ts` (`createMainView(container)`: one `WebGLRenderer` with pixel ratio capped at `DEVICE_PIXEL_RATIO_CAP`; `PerspectiveCamera` with aspect set to 16/9 and `filmGauge` 36 before `setFocalLength`; ground `GridHelper` only; `showFrame` calls `rig.evaluate` into one preallocated `OutBuffer`, then `position.set` and `quaternion.set`; renders on change through one `requestAnimationFrame` at a time, with a callback made once; a `ResizeObserver` sets the size; a WebGL failure or lost context shows a plain message with a next step). Wrote `src/main.ts` (entry: builds the first sample shot's rig, shows displayed frame 0, and a lens menu from `LENS_PRESETS_MM`) and wired `index.html` (stage box, lens menu, module script). No test imports `main-view.ts` or `main.ts`. Not run by Kiro.
- Open API shape, my choice: the task named only `main-view.ts`, but `index.html` needs an entry module, so I added `src/main.ts`. Grid size, near/far planes and colours are local constants in `main-view.ts`, not in `constants.ts` (I may not change it). The lens menu changes only the view's focal length, not the rig settings.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet. Assumes `PerspectiveCamera.setFocalLength` uses the film height from aspect and `filmGauge` (so the aspect must be set first).
- PathKit features used: evaluateEntity (through `CameraRig.evaluate`), bake, followPath, orbitAround, aimAt (through the rig).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 28.2: CameraRig tests (newest entry, kept at top)
- Done: wrote `test/view/camera-rig.test.ts` (14 `it` blocks, 16 Vitest tests; `it.each` over 3 bad shot lengths). Covers: `RebakeScheduler` coalescing; five `markDirty` calls give one bake at `tick()` (bakeCount 0 before it); camera-only change keeps `subjectBakeCount`; Road change and subject kind change rebake the subject; after a bake play state is paused and the displayed frame is unchanged; `evaluate` returns the given buffer (and keeps its inner objects) for 1000 calls; hand value (22, 2.2, 8) at frame 0; unknown camera throws; bake errors come back as messages (shot length 0, 10.5, -5, unknown main camera, 2-point Road) and the last good bake stays; findings for other cameras are dropped (main cam-1 and main cam-2). Expected findings come from a solo bake through the logic modules, not from `CameraRig`. Not run by Kiro.
- Extension (user-requested, test only, no src change): `camera-rig.test.ts` gained 6 `it` blocks (now 20 blocks, 22 Vitest tests): empty tick returns null; orbit bearing 90 offsets at frames 0, 120, 239; orbit aim at frame 0; crane position at frames 0, 120, 239; push-in start; `placementOf`. New file `test/view/camera-rig-linter-error.test.ts` (1 block, 1 test) mocks `motionLinter` to throw and checks ok, the message, no findings, bakeCount 1 and camera z = 8. Not run by Kiro.
- Open API shape, my choice: the other-camera finding is `aim-vertical` from a tracking camera at radius 3 m, height 100 m (outside the UI's height limit of 40 m; `CameraRig` does not range-check). 40 m would not work: 3/40 is above tan 3 degrees.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet. Assumes `buildKeyframedTarget` / `buildCameraScene` error texts ("got <value>") and the `validateRoad` message stay as they are.
- PathKit features used: bake, createCurve, createArcLengthTable, motionLinter, followPath, orbitAround, aimAt.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 28.1: camera-rig.ts (newest entry, kept at top)
- Done: wrote `src/view/camera-rig.ts`: `RebakeScheduler` (pure dirty flag, `markDirty`, `consume`), `CameraRig` (`setSettings`/`markDirty` only mark dirty; `tick()` is called once per animation frame and re-bakes at most once; `bake(settings)`; `evaluate(cameraId, frame, out)` calls only `evaluateEntity` and returns `out`; `findingsForMain`, `placementOf`, `bakeCount`, `subjectBakeCount`). The subject bake is cached by `subjectKind` plus the Road points, so a camera-only change does not rebake it. Camera scenes go through `buildKeyframedTarget` (the orbit centre target is the subject raised by `heightM`), `buildSceneSet`, `bake`, `motionLinter`; only findings with `entityId` equal to the main camera are kept. Errors come back as "the camera move could not be built: <message>. Try a different setting." and "the motion check could not run: <message>."; on a build error the last good bake stays. Not run by Kiro.
- Open API shape, my choice: no `RigSettings` type existed, so it and `CameraSetting` are defined in this file (as in the design's class diagram). The rig holds `playing` and the displayed frame only so a re-bake can set playing to false and leave the frame alone (the 28.2 test needs a reported play state). A bad Road returns the `validateRoad` message and bakes nothing. All subject kinds use the same car-axes road bake. No setting is stored by the rig, so `readSetting`/`writeSetting` are not used here.
- Broke: nothing known. Not run by Kiro. `tick` allocates a `BakeOutcome` only when a re-bake runs.
- Kiro got wrong: nothing known yet.
- PathKit features used: bake, createCurve, createArcLengthTable, evaluateEntity, motionLinter, followPath, orbitAround, aimAt (validateScene runs inside bake).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 26.1: samples integration test (newest entry, kept at top)
- Done: wrote `src/logic/samples.ts` (`SAMPLE_SHOTS`: orbit 0°/1.5 m/8 m/35 mm, push-in 30°/-0.3 m/12 m/50 mm, crane 180°/0.5 m/10 m/35 mm, shot length 240) and `test/logic/samples-integration.test.ts` (8 `it` blocks, 14 Vitest tests). Each sample goes through subject bake, `buildKeyframedTarget`, `buildSceneSet` (one main camera, `cam-1`), `validateScene`, `bake`, `motionLinter`; the finding count is printed. Hand-computed camera positions: orbit frame 0 (22, 2.2, 8) and 0.75°/frame offsets; push-in frame 0 (28, 0.4, 12 cos 30°) and y at frames 120/239; crane x/z fixed, y = 1.2 + 6f/240. Not run by Kiro.
- Open API shape, my choice: no `RigSettings` type exists in src, so `samples.ts` defines `SampleShot` (name, shotType, placement, shotLengthFrames). The orbit centre target is the subject target raised by `heightM`; the real app may build it differently.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet. The hand values assume the road's first point (22, 0.7, 0) is the subject position at baked frame 0.
- PathKit features used: bake, validateScene, evaluateEntity, motionLinter, followPath, orbitAround, aimAt.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 25.2: storage tests (newest entry, kept at top)
- Done: wrote `test/logic/storage.test.ts` (12 `it` blocks, 14 Vitest tests): getItem throws, setItem throws, storage null (read and write), invalid JSON, missing key, prefix `shot-rail:speed` with stored text `42`, round trip (`it.each`, 3 tests), default storage read and write in node, undefined value, circular value. Mock `StorageLike` objects only. Expected values written by hand. Not run by Kiro.
- Extension (user-requested, tests only): added helper `withGlobalLocalStorage` and 2 `it` blocks (now 14 blocks, 16 Vitest tests): a fake `globalThis.localStorage` receives the default-argument read and write under `shot-rail:`, and a `localStorage` getter that throws gives the fallback and no error. The helper restores the original descriptor, or deletes the property if there was none. No src change. Not run by Kiro.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet. The "missing storage" case is the `null` argument; in node the default path returns null or whatever node's own localStorage gives, so those two tests only check "no throw / fallback".
- PathKit features used: none.
- Not tested: look, WebGL output, real browser localStorage, PNG download, feel of controls, dev server.

## Task 25.1: storage.ts (newest entry, kept at top)
- Done: wrote `src/logic/storage.ts`: `readSetting(key, fallback, storage?)` and `writeSetting(key, value, storage?)`, values stored as JSON under `STORAGE_KEY_PREFIX + key`, every access in try/catch. Not run by Kiro.
- Open API shape, my choice: `storage` is an optional last parameter of type `StorageLike` (`getItem`/`setItem`), default is the browser localStorage looked up inside try/catch; `null` means "no storage" and gives the fallback / a no-op. The design only showed `(key, fallback)` and `(key, value)`.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit features used: none.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 24.2: contrast tests (newest entry, kept at top)
- Done: wrote `test/logic/contrast.test.ts` (7 `it` blocks, 9 Vitest tests): black/white 21 (1e-9), white/white 1, #777777 about 4.48 (below 4.5), #767676 about 4.54 (above 4.5), #666666 about 5.74 and #595959 about 7.0 (published WCAG values), order-independence (`it.each`, 3 Vitest tests). Not run by Kiro.
- Update (user request, tests only): added 4 `it` blocks (12 Vitest tests) to `contrast.test.ts`: pure red/green/blue on black (`it.each`, 3 tests, both orders), #0a0a0a on black about 1.0607 (linear branch), and 8 bad colour strings that must throw "expected a colour like" in either position (`it.each`). File now has 11 `it` blocks, 21 Vitest tests. Expected values written by hand. Not run by Kiro; the User runs `npm.cmd test` from apps/shot-rail.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: the task's #777777 case alone would not catch the 0.4045 threshold change (its channel is 0.467, above both thresholds), so I added #666666 (channel 0.4).
- PathKit features used: none.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 24.1: contrast.ts (newest entry, kept at top)
- Done: wrote `src/logic/contrast.ts`: `contrastRatio(fg, bg)` using the WCAG relative-luminance formula (0.04045 threshold, 0.2126/0.7152/0.0722 weights, +0.05 terms, order-independent). `RgbColor` was not defined anywhere in the design, so I defined it as a `"#rrggbb"` string; an invalid string throws an Error. Not run by Kiro.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet. The `RgbColor` format is my choice; tell me if you want `[r,g,b]` instead.
- PathKit features used: none (pure function, no imports).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 23.2: findings tests
- Done: wrote `test/logic/findings.test.ts` (5 `it` blocks, 10 Vitest tests): five codes vs hand-written design table text (`it.each`), unknown code with info/warning (`it.each`), "constructor" treated as unknown, empty list text contains "rough", order kept for a mixed list. Not run by Kiro.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit features used: `Finding` and `Severity` types.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 23.1: findings.ts
- Done: wrote `src/logic/findings.ts`: `describeFinding`, `describeFindings` (items plus `emptyMessage`), `NO_PROBLEMS_MESSAGE` (contains "rough"). Five codes use the design table wording and "Note"/"Warning"; an unknown code uses its own message and severity. Not run by Kiro.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit features used: `Finding` and `Severity` types from `motionLinter`'s output.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 22.2: Scene_Set tests
- Done: wrote `test/logic/scene-set.test.ts` (5 tests): Outcome A (1 scene, each id once), Main_Camera first, `validateScene`, 7 values vs a solo bake of each camera over 30 frames (tolerance 1e-9), missing main camera throws. Not run by Kiro.
- Update (user request): `buildSceneSet` now throws when a camera other than the main camera is a push-in or crane shot (one scene has one path). In the test setup cam-4 is now a tracking shot with its own centre target. Added tests: push-in main camera first with no Road vs solo bakes, non-main push-in/crane throws (`it.each`, 2 Vitest tests), missing centre target for an orbit camera throws. 8 `it` blocks, 9 Vitest tests. Not run by Kiro.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit features used: `validateScene`, `bake`, `evaluateEntity`.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 21.2: Shot_Builder tests
- Done: wrote `test/logic/shot-builders.test.ts` (9 tests). Not yet run by the User.
- Update (user request): crane speed now compared with tolerance 1e-12 (8.7 - 2.7 is 5.999999999999999). Added rail geometry (still and moving subject), supplied path, orbit/tracking path, centre target, bad shot length and empty keyframes tests. File now has 19 runtime tests. Not run by Kiro.
- Broke: nothing known. Not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit features used: `validateScene`, `bake` (travelled, transforms), `motionLinter`.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

One short entry per task: what was done, what broke, what Kiro got wrong, which PathKit feature was used.

## Task 2.1: Create the app files

- Done: created package.json, tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore, index.html, src/logic/pathkit.ts, src/logic/constants.ts, THIRD_PARTY.md, and the docs stubs.
- Broke: nothing known. No command has been run yet.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none yet (only the re-export file exists).
- Open risk for the first build: Vite resolving the import from outside the app root, and the tsconfig type-checking PathKit source without new errors.
- Follow-up fix to 2.1: PLACEHOLDER_PATH in constants.ts was `as const` (readonly points). It now has the explicit type `{ points: Vec3[]; closed: boolean }`, with `Vec3` imported from './pathkit.js', so it fits PathKit's Scene['path'].

## Task 3.1: constants consistency test
- Done: wrote `test/logic/constants.test.ts` (derived values, ordered ranges and thresholds, CAMERA_IDS length, axis pairs on different axes). Awaiting the User's `npm.cmd test` output.
- Broke: nothing known yet.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none (constants only).

## Task 4.1 Default Road points
- Done: added `src/logic/default-road.ts` with 12 hand-placed points on a 44 m by 32 m oval (y = SUBJECT_CENTRE_HEIGHT), closed. Hand estimate: about 120 m round, tightest bend radius about 12 m.
- Broke: nothing known. Not run yet; the length and radius are checked in task 4.2.
- Kiro got wrong: nothing yet.
- PathKit feature used: only the `Vec3` type (through `pathkit.ts`).

### Task 4.2: default Road tests
- Done: added `test/logic/default-road.test.ts` (count 12, every y, no equal consecutive points, length 110 to 130 m printed, bend radius at least 8 m by a hand-written circle formula).
- Broke: nothing known yet; tests not run by Kiro.
- Kiro got wrong: nothing known yet.
- PathKit used: `createCurve`, `createArcLengthTable` (length only).

### Task 5.1: frame-remap.ts
- Done: added `src/logic/frame-remap.ts` with `remapDisplayedFrame` (remainder first, ease, `min` guard, whole-number check that names the value). Not run yet; tests come in 5.2.
- Broke: nothing known. Kiro normalises `-0` to `0` in the result.
- Kiro got wrong: nothing yet.
- PathKit feature used: none (pure app-side function).

## Task 5.2: Frame_Remap tests
- Done: added `test/logic/frame-remap.test.ts` (worked table, 0 to 599 sweep, invalid-value throws). Not yet run by the User.
- What broke: nothing known yet.
- What Kiro got wrong: nothing known yet.
- PathKit feature used: none (pure remap only).

## Task 6.3: S1 tolerance
- Done: added the agreed tolerances to `test/spike/s1.test.ts` part (a), with a comment holding the measured values. Date: 2026-11-24. Not yet run by the User.
- Agreed tolerances (User): each step's relative deviation from the mean at most 2% (0.02); absolute difference between the sum of all 1920 steps and the road length at most 0.001 m.
- Measured values: road length 120.0016939269426 m; sum of steps 120.00182472320051 m; mean step 0.06250095037666693 m; min step 0.061645873853354564 m; max step 0.06335471825121827 m; largest relative deviation 0.013681016339098564 at step 138; sum minus road length about 0.000131 m; remap step ratio 2.9999836394771395.
- Broke: nothing known.
- Kiro got wrong: nothing known yet.
- PathKit feature used: `bake`, `evaluateEntity`, `createArcLengthTable`, `followPath`.

## Task 8.1: S3 test (orbitAround, speed 0, keyframed target)
- Done: wrote `test/spike/s3.test.ts`. Target runs a straight line over 60 frames. Camera orbits it (axis +Y, radius 8, speed 0, startAngle 30). Test checks camera minus target equals (4, 0, 6.9282032) within 1e-9 on every frame, and that the camera moves 118 m in x.
- Broke: not run yet (Kiro cannot run commands).
- Kiro got wrong: nothing known yet.
- PathKit feature used: `orbitAround` with a keyframed target.
- Fix attempt 1: the test's expected z was the rounded literal 6.9282032 (true 6.92820323027551), so the 1e-9 check failed by 3.03e-8; the baked value was correct. The expected offset is now computed as radius*sin and radius*cos of the start angle in radians (30 degrees converted once). Tolerance unchanged. Not yet re-run by the User.
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 9.1: S4 test (two targets, height and aim)
- Done: wrote `test/spike/s4.test.ts` (5 cases of (h, r), plus a wrong-target check with aimAt on `centre`). Not yet run by the User.
- What broke: nothing known yet.
- What Kiro got wrong: nothing known yet.
- PathKit feature used: `orbitAround` (speed 0) then `aimAt`, `rotateVec`, keyframed targets.

## Task 10.1: S5 test written
- Done: `test/spike/s5.test.ts` bakes the subject (1920 frames at 240 fps) and six orbiting cameras (240 frames, orbitAround then aimAt), prints the bake time and `S5_TARGET_MS`, asserts six ids `cam-1` to `cam-6` in order. Time is never asserted. Not yet run.
- Broke: Kiro sent an edit call to a frozen PathKit file by mistake (meant to read it). The hook blocked it and nothing changed.
- PathKit features used: `bake`, `followPath`, `orbitAround`, `aimAt`, keyframed target.

## Extra test: CAMERA_IDS literal check (user request, outside task 10.1)
- Done: added one test to `test/logic/constants.test.ts` checking `CAMERA_IDS` equals `cam-1` to `cam-6` in order, written as literal text. No source file changed. Not yet run by the User.
- Broke: nothing known.
- PathKit feature used: none.

## Task 10.2: S5 bake time measurement
- Measured: S5 bake time (subject + 6 cameras) was 155.03 ms in the Vitest Node process, one run. The target is 100 ms (`S5_TARGET_MS`).
- Result: OVER the target by about 55 ms.
- The test does not fail on timing. It only prints the time and the target; it asserts the six camera ids, not the duration.
- This is one run only and may vary between runs and machines. The run had 45 tests passed, 0 failed, 0 skipped.
- Broke: nothing. No code changed in this step.
- PathKit features used: `bake`, `followPath`, `orbitAround`, `aimAt`.

## Extra change: S5 timing split (user request, outside task 11.1)
- Done: `test/spike/s5.test.ts` now times the subject bake and the camera bake separately. Each runs 5 times through one helper (`timeBake`). Run 1 is printed as cold (includes JavaScript warm-up); the median of runs 2 to 5 is printed as warm. Four lines are printed: subject, cameras, total cold, total warm (target `S5_TARGET_MS`, printed, not asserted).
- Why: the first measurement (task 10.2) was 155.03 ms as one number, so it did not show which bake is slow or how much was warm-up. This split shows both.
- Assertions unchanged (frame counts, ids `cam-1` to `cam-6`, constants test); they run on the first run's result. Time is never asserted. No source or packages/ file changed. Not yet run by the User.

## Task 11.2: S6 outcome and S5 re-measurement (user checkpoint)
- Outcome recorded: **S6 Outcome A**. One combined scene gives the same baked values as separate scenes. Task 22 hard-codes Outcome A: one scene with every camera.
- S6 measured result: cam-1 to cam-4 each compared 1920 frames x 7 values = 13440 values. Largest difference per camera 0; largest difference over all cameras 0; mismatching values 0; tolerance 1e-9.
- Run: `npm.cmd test` from apps/shot-rail, 47 passed, 0 failed, 0 skipped (pasted by the User).
- S5 re-measurement (timing split from the extra change above):
  - Subject bake (1920 frames): cold 56.65 ms, warm median 15.03 ms.
  - Camera bake (6 cameras, 240 frames): cold 26.23 ms, warm median 5.30 ms.
  - Total cold: 82.88 ms; total warm: 20.33 ms; target 100 ms (printed, not asserted).
  - Both totals are under 100 ms. The earlier single-number run (task 10.2) measured 155.03 ms. Timing varies between runs (machine load). Only one run of each is recorded, so neither figure is a stable average.
- Broke: nothing. No code changed in this step; no task status changed.
- Kiro got wrong: nothing known.
- PathKit features used: `bake` (combined scene vs separate scenes), `followPath`, `orbitAround`, `aimAt`.

## Task 12.1: Lap seam test
- Done: `apps/shot-rail/test/spike/lap-seam.test.ts` (2 tests).
  - Part (a): default Road seam angle 0.41563695642562715 degrees (limit 2 degrees).
  - Part (b): hand-written twisted 3D figure-eight (12 points, x = 20 sin t, y = 8 cos t, z = 10 sin 2t, every 30 degrees), checked with `bake` directly, no Road validation. Seam angle 166.95837288576024 degrees (must exceed 40).
- Run: `npm.cmd test` from apps/shot-rail, 49 passed, 0 failed, 0 skipped (pasted by the User).
- S5 timing in that same run:
  - Subject bake: cold 70.17 ms, warm median 17.37 ms.
  - Cameras bake: cold 84.11 ms, warm median 9.64 ms.
  - Total cold: 154.28 ms (over the 100 ms target); total warm: 27.01 ms.
  - The cold total varies between runs (82.88 ms in task 11.2, 154.28 ms here) and can exceed 100 ms. The warm total stays well under 100 ms.
- Broke: nothing. Only this file changed; no code, nothing under packages/, no task status changed.
- Kiro got wrong: nothing known.
- PathKit features used: `bake` (seam check on the baked data).

## Task 14.1: Implement lens.ts
- Done: wrote `src/logic/lens.ts` with `FieldOfView` and `fieldOfViewForFocalLengthMm`. It uses `SENSOR_WIDTH_MM / 2` (18) and `SENSOR_HEIGHT_MM / 2` (10.125) from constants, works in radians and converts to degrees at the output. It throws an Error naming the value for 0 or less, NaN and Infinity.
- Broke: nothing known. No command has been run; the lens tests (14.2) do not exist yet.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none (pure maths, no PathKit import).

## Task 14.2: Lens tests

- Done: added `test/logic/lens.test.ts` (5 tests): hand-written table at 24/35/50/85 mm within 0.05 (1-decimal rounding), unrounded 24 mm vertical 45.747 within 0.001 and not 45.75, an independent `atan2` check against the sensor constants for 8 focal lengths, throws naming the value for 0, -1, -0.001, NaN, Infinity, and same input gives same output.
- Broke: nothing known. Not run by Kiro; awaiting the User's `npm.cmd test` output.
- Kiro note: I checked the 45.747 figure by hand series (about 45.748), inside the 0.001 band.
- PathKit feature used: none (pure lens function).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 15.1: Implement labels.ts

- Done: wrote `src/logic/labels.ts` with `angleLabel` (overhead checked first; above 60 overhead, above 10 high angle, -10 to 10 eye level, below -10 low angle) and `framingLabel` (above 70 close-up, 35 to 70 medium, below 35 wide). Thresholds come from `constants.ts`. `framingLabel` throws an Error naming the value for NaN, Infinity, below 0 or above 100.
- Broke: nothing known. No command has been run; the label tests (15.2) do not exist yet.
- Kiro got wrong: nothing known.
- PathKit feature used: none (pure logic, no PathKit import).

## Task 15.2: Label tests

- Done: added `test/logic/labels.test.ts` (6 tests): the 9-row elevation table, an explicit `angleLabel(10)` eye-level check, 90 and -90, the 6-row fill table, 0 and 100 accepted, and throws naming the value for -0.1, 100.1, NaN, Infinity. Not yet run by the User.
- Broke: nothing known.
- Kiro got wrong: nothing known yet.
- PathKit feature used: none (pure labels).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 16.1: Implement fill.ts

- Done: wrote `src/logic/fill.ts` with `subjectBoxCorners`, `projectToNdc`, `fillFractionPercent` and `framingPercent`. Buffers are caller-supplied; the three helper vectors/quaternion are module-level scratch objects made once at load, so calls allocate nothing. A point with depth above `-NEAR_EPSILON` gets NDC (0, 0) and makes `projectToNdc` return false; `framingPercent` then returns 100. Non-finite values and counts below 1 throw an Error naming the label, index and value.
- Added beyond the design text (small guards): a non-whole count, buffers that are too short, `verticalFovRad` outside (0, pi) and `aspect` at or below 0 also throw, since they would give NaN or Infinity.
- Broke: nothing known. No command has been run; the tests (16.2) do not exist yet.
- PathKit features used: `rotateVec`, `quatInverse` (through `src/logic/pathkit.ts`).
- Not tested: everything so far (no tests yet), look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 16.2: Fill_Fraction tests

- Done: added `test/logic/fill.test.ts` (8 tests): three NDC cases (50, 90, 75), the realistic pose (all 8 corners against the design table by hand formulas, two corners to 5 decimals, fill 44.3, medium), behind-camera (`projectToNdc` false, `framingPercent` 100), and throws for NaN and count 0. Not yet run by the User.
- Extension (User-requested, test only): added 8 tests to `fill.test.ts`: moved car and camera (same fill, plus all 8 corners checked, because a dropped `position.y` leaves the fill unchanged), rotated camera (90 degrees about +Y, fill 67.155 by hand, width decides), vertical clipping (75), a point on the camera counts as behind, and four `projectToNdc` throws (fov = pi, aspect 0, count 1.5, `outNdc` one number short). Expected values written by hand. Note: the file had 9 tests before this, not 8 as written above. Not yet run by the User.
- Broke: nothing known. Kiro mapped the design table's corner numbers to code indices (table 1 to 4 are code 4 to 7, table 5 to 8 are code 0 to 3) because the code uses sign bits, not the table order.
- Source line it should catch: `Math.max(w, h)` changed to `Math.min(w, h)` in `fillFractionPercent` fails the height-decides case; removing `if (!inFront) return 100;` in `framingPercent` fails the behind-camera test.
- PathKit feature used: `quatInverse`, `rotateVec` (through `fill.ts`).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 17.1: Implement frame-mapper.ts

- Done: added src/logic/frame-mapper.ts with scrubToFrame (clamp, then round, then `+ 0` so no -0; non-finite throws naming the value), frameToSeconds and secondsToFrame (rounds to the nearest whole frame).
- Broke: nothing known. No command has been run, so nothing is tested yet.
- Kiro got wrong: nothing known yet. One thing to watch: `Math.round(-0.4)` gives -0, which the `+ 0` fixes.
- PathKit feature used: none (pure app logic).

## Task 17.2: Frame_Mapper tests

- Done: added `test/logic/frame-mapper.test.ts` (3 tests): the 9-row scrub table for lastFrame 239 (hand-written results, each checked whole and not -0), throws naming the value for NaN, Infinity and -Infinity, and the round trip `secondsToFrame(frameToSeconds(f, 30), 30)` for every whole frame 0 to 600. Not yet run by the User.
- Extension (user-requested, test only): added a 4th test, `secondsToFrame never returns -0`. It checks `secondsToFrame(-0.01, 30)` and `secondsToFrame(-0, 30)` are 0 and not -0 (explicit `Object.is` check). It should fail if the `+ 0` in `secondsToFrame` is removed. `frame-mapper.test.ts` should now have 4 tests. The User runs `npm.cmd test` from `apps/shot-rail`.
- Correction: removing the `+ 0` in `scrubToFrame` is an equivalent change, because the clamp `Math.max(scrubValue, 0)` already turns -0 into +0. The task hint saying the -0 check fails for `scrubToFrame` was wrong. Only `secondsToFrame` can return -0.
- Broke: nothing known. One slip: Kiro tried a terminal command to read the notes file, and the hook blocked it. Nothing changed.
- PathKit feature used: none (pure app logic).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 18.1: Implement road-validation.ts

- Done: added `src/logic/road-validation.ts` with `validateRoad(points)`. It returns `{ ok: true, road }` (closed road, copied points) or `{ ok: false, message }`. Checks in order: count outside 3 to 100 (message names the count and "3 to 100"), non-finite coordinate, y differs from point 0, coincident consecutive points including last to first (exact equality, same as PathKit's `sameSpot`). Limits come from `ROAD_POINTS_MIN` and `ROAD_POINTS_MAX`.
- Broke: nothing known. No command has been run; the tests (18.2) do not exist yet.
- Kiro got wrong: nothing known. Choices not in the task text: the return shape (a result union) and the extra non-finite check, so NaN gives a clear message.
- PathKit feature used: only the `Vec3` type (through `pathkit.ts`); `createCurve` is not called.
- Not tested: everything (no tests yet), look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 18.2: Road validation tests

- Done: added `test/logic/road-validation.test.ts` (7 tests): 2 and 101 points refused with the count, "3" and "100" in the message; 3 and 100 points accepted (3-point case also checks closed and the exact copied points); one duplicated consecutive point refused; last point equal to first refused; one point at a different y refused. Candidates are a flat zigzag (x = 10 * i, z = 0 or 5, y = 0.9), expected values written by hand. Not yet run by the User.
- Extension (user-requested, tests only): added 10 `it` blocks, 17 in total. A point lower than point 0; point 1 at a different y; shared x with different z is accepted; NaN and Infinity in each of x, y, z of point 2 (6 blocks, message must contain "point 2"); returned road is a copy (array differs, and changing the input point object or replacing its entry leaves `road.points[0]` unchanged, because the source copies each point). Expected values written by hand. Not yet run; the User runs `npm.cmd test` from apps/shot-rail.
- Broke: nothing known. Kiro tried a terminal command by mistake while looking for the end of the notes; the hook blocked it and nothing changed.
- PathKit feature used: only the `Vec3` type (through `pathkit.ts`).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server, non-finite coordinates (not in the task).

## Task 19.1: Implement shot-length.ts

- Done: added `src/logic/shot-length.ts` with `validateShotLength(value)`. It returns `{ ok: true, value }` or `{ ok: false, message }` (same style as `validateRoad`). Refuses NaN, Infinity, non-whole numbers, below 60 and above 600; every message states the range "60 to 600". Limits come from `SHOT_LENGTH_MIN` and `SHOT_LENGTH_MAX`.
- Broke: nothing known. No command has been run; the tests (19.2) do not exist yet.
- Kiro got wrong: nothing known. Choice not in the task text: the result-union return shape (the design had no signature to follow).
- PathKit feature used: none (pure logic).
- Not tested: everything (no tests yet), look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 19.2: Shot_Length tests

- Done: added `test/logic/shot-length.test.ts` (6 tests): 60/240/600 accepted, 59 and 601 refused, non-whole values (240.5, 59.5, 600.5, 60.25) refused, NaN/Infinity/-Infinity refused, 0 and negatives refused, and a sweep of 0 to 700. Each refusal checks the message contains the literal "60 to 600" and the value text. Not yet run by the User.
- Broke: nothing known.
- Kiro got wrong: nothing known.
- PathKit feature used: none (pure app logic).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 20.1: Target_Converter
- Done: wrote `src/logic/target-converter.ts` with `buildKeyframedTarget`. One keyframe per displayed frame, position read with `evaluateEntity` at `remap(f)`, y shifted by `heightOffsetM`, x and z copied. Throws on a bad `displayedFrameCount`. Awaiting the User's `npm.cmd test` output (the tests are task 20.2).
- Broke: nothing known. No command has been run.
- Kiro got wrong: nothing known yet.
- PathKit feature used: `evaluateEntity` with one reused output buffer, and the `Keyframe` and `BakedData` types.
- Not tested: everything here; the tests come in 20.2.

## Task 20.2: Target_Converter tests

- Done: added `test/logic/target-converter.test.ts` (4 tests). Fixture: straight-line subject (open 2-point path, fps 24, speed 24 m/s, so baked position at frame b is (b, 2, -3) written by hand), remap table [0,0,3,5,5,24,12,1], offsets 0, 1.5, -0.3, 40. Checks: one keyframe per displayed frame with frame equal to index; position equals the table's baked frame with y raised by the offset; rise compared with offset 0; 0 frames gives empty, bad counts throw. Not yet run by the User.
- Broke: nothing known. Assumption to confirm on first run: a 2-point open curve is straight and arc length is accurate within 1e-6.
- PathKit feature used: `bake`, `followPath` (via `buildKeyframedTarget`, which calls `evaluateEntity`).
- Not tested: look, WebGL output, real browser, PNG download, feel of controls, dev server.

## Task 21.1: Shot_Builders
- Done: wrote `src/logic/shot-builders.ts` with `buildCameraScene` (tracking, orbit, push-in, crane) and an exported `buildRail`. Constraint order is orbitAround/followPath at 0, aimAt at 1. Orbit speed is ORBIT_SWEEP_DEG / (N / FRAME_RATE). Rail speed is length * FRAME_RATE / N.
- Broke: nothing known. No command has been run; tests are task 21.2.
- Kiro got wrong: nothing known yet. Judgement call: for push-in and crane a non-null `path` argument is used as the rail, and null builds the rail from the subject target. The design signature does not say which one wins.
- PathKit feature used: followPath, orbitAround, aimAt constraints and the Scene types.
- Not tested: everything (no test yet, no command run).

## Task 22.1: Implement scene-set.ts

- Done: wrote `src/logic/scene-set.ts` with `buildSceneSet` and the constant `S6_OUTCOME = 'A'` (reason in a comment, from Task 11.2). It returns one scene with every camera: Main_Camera first, then the others in map order. Each camera comes from `buildCameraScene`; the scene takes the Main_Camera's path and the union of all targets (`centre-<id>` names are unique per camera). Throws naming the id for an unknown main camera or a non-rail camera with no centre target.
- Changed from the design: the design signature has an `outcome: 'A' | 'B'` parameter. The task says to write the outcome in as a constant, so there is no such parameter and no Outcome B code.
- Broke: nothing known. Not run; the tests are task 22.2.
- Kiro got wrong: nothing known.
- PathKit feature used: only the `Scene` and `Target` types (through `pathkit.ts`); scene building goes through `buildCameraScene`.
