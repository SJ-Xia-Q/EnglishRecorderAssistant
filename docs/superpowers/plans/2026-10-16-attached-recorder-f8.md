# Attached Recorder And F8 Shortcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the original platform recorder visually attached to the draggable pace assistant without covering the submit area, and replace Space with a focus-independent F8 primary shortcut.

**Architecture:** Preserve the platform recorder in its existing DOM parent and position it as a viewport sidecar using namespaced attributes and CSS custom properties. The overlay reports its resolved rectangle to the content script, which asks the DOM module to place the recorder beside it and to toggle compact/expanded sizing. The content script captures F8 globally and removes all Space interception.

**Tech Stack:** Chrome Manifest V3, vanilla JavaScript, Shadow DOM, Playwright Python tests, Node test runner.

---

### Task 1: Specify the attached recorder behavior

**Files:**
- Modify: `tests/fixtures/platform.html`
- Modify: `tests/extension_smoke.py`
- Modify: `tests/extension_adversarial.py`

- [ ] **Step 1: Add a realistic tall recorded-state fixture and a fixed submit target.**

Add `window.mountRecordedRecorder()` with two audio rows and add `#submit-action` at the lower edge of the fixture so the old bottom dock demonstrably overlaps it.

- [ ] **Step 2: Add failing observable assertions.**

Assert that the recorder exposes compact sizing, sits within 12px of one side of the assistant, does not overlap `#submit-action`, follows the assistant by the same drag delta, grows after “展开录音区”, is undocked when the assistant closes, and is redocked after toolbar restoration.

- [ ] **Step 3: Run the focused extension tests and confirm RED.**

Run: `npm run test:extension`

Expected: FAIL because recorder placement is still fixed to the viewport bottom and no recorder-size control exists.

### Task 2: Implement the sidecar layout

**Files:**
- Modify: `extension/dom.js`
- Modify: `extension/overlay.js`
- Modify: `extension/overlay.css.js`
- Modify: `extension/content.js`

- [ ] **Step 1: Add DOM docking APIs.**

Keep `dockRecorder(recorderRoot)`, add `layoutRecorder(recorderRoot, anchorRect, expanded)` and `undockRecorder(recorderRoot)`. The layout function must set compact/expanded attributes, select left/right/above/below placement from actual viewport space, clamp the result, and publish pixel values through `--era-recorder-*` variables. The injected recorder rule must use those variables, internal scrolling, and no bottom/center transform.

- [ ] **Step 2: Report overlay layout changes.**

After render, drag and resize, call `callbacks.onLayoutChange(host.getBoundingClientRect())`. Add a text control whose accessible name alternates between “展开录音区” and “缩小录音区”.

- [ ] **Step 3: Coordinate visibility and persistence.**

Store `recorderExpanded` in `chrome.storage.local`. On every overlay layout callback, position the current recorder. On close, undock it; on toolbar restore, dock and lay it out again. New SPA recorder nodes inherit the current visible and size state.

- [ ] **Step 4: Run focused tests and confirm GREEN.**

Run: `npm run test:extension`

Expected: PASS with recorder sidecar, resize, drag, close and restore assertions.

- [ ] **Step 5: Commit the sidecar behavior.**

Commit: `feat: attach recorder to draggable assistant`

### Task 3: Replace Space with global F8

**Files:**
- Modify: `tests/extension_smoke.py`
- Modify: `tests/extension_adversarial.py`
- Modify: `extension/content.js`
- Modify: `extension/overlay.js`

- [ ] **Step 1: Change tests before production code.**

Assert literal Space leaves the assistant in `reading`. Focus a text input and the fake platform recorder button in separate cases, press F8, and assert the assistant enters its timer while the platform button click counter remains unchanged. Assert repeated F8 and F8 during a timer do not shorten it.

- [ ] **Step 2: Run the shortcut tests and confirm RED.**

Run: `npm run test:adversarial`

Expected: FAIL because F8 is not handled and Space is still the configured shortcut.

- [ ] **Step 3: Implement the minimal F8 handler and copy changes.**

Listen for non-repeated `F8` on `window` in capture mode. Only in `reading`, prevent default, stop propagation, and invoke the existing primary action. Remove `shortcutBlockedTarget` and every Space label from the overlay.

- [ ] **Step 4: Run shortcut and full browser tests.**

Run: `npm run test:adversarial`

Expected: PASS.

Run: `npm run test:extension`

Expected: PASS.

- [ ] **Step 5: Commit the shortcut behavior.**

Commit: `feat: replace space shortcut with global f8`

### Task 4: Documentation, release artifact and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-10-16-english-recording-assistant-design.md`
- Modify: `docs/adr/0001-use-manifest-v3-floating-overlay.md`
- Modify: `docs/adversarial-acceptance.md`
- Modify: `extension/manifest.json`
- Modify: `package.json`
- Modify: `dist/english-recording-assistant.zip`

- [ ] **Step 1: Document the new interaction and bump to 0.3.0.**

Replace Space guidance with F8, describe attached compact/expanded recorder behavior and close/restore semantics, and record adversarial coverage.

- [ ] **Step 2: Run all verification.**

Run: `git diff --check`

Run: JavaScript syntax checks and JSON parsing.

Run: `npm test`

Run: `npm run test:dom`

Run: `npm run test:extension`

Run: `npm run test:adversarial`

Expected: every command exits 0 with no test failures.

- [ ] **Step 3: Inspect screenshots and package.**

Review both generated PNG artifacts for viewport overflow and submit-button obstruction. Run `scripts/package-extension.ps1`, verify the ZIP contains only extension runtime resources, and compute SHA-256.

- [ ] **Step 4: Commit the release update.**

Commit: `docs: release attached recorder controls`

## Review Focus

- Platform recorder remains the original node in its original parent.
- Layout calculations survive large recorder contents, narrow/high-zoom viewports, SPA replacement, panel compacting and persisted positions.
- Closing the helper cannot leave a fixed orphan recorder covering the page.
- F8 works with page controls focused, cannot repeat-trigger, and Space is never intercepted by the helper.
