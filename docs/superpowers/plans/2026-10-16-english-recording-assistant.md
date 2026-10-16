# English Recording Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a load-unpacked Chrome/Edge extension that keeps the platform's real recorder controls visible and guides ordinary pauses plus the fixed five-second post-red reading window.

**Architecture:** A Manifest V3 content script scans the visible platform DOM, parses turns into a small immutable session state machine, renders a Shadow DOM overlay, and applies one scoped fixed-position class to the platform's existing recorder container. The extension does not record audio or make network requests.

**Tech Stack:** Manifest V3, plain JavaScript, Shadow DOM, `chrome.storage.local`, Node.js built-in tests, Playwright Chromium extension tests.

**Spec:** `docs/plans/2026-10-16-english-recording-assistant-design.md`

---

### Task 1: Deterministic script and timing core

**Files:**
- Create: `package.json`
- Create: `extension/core.js`
- Create: `tests/core.test.mjs`

**Interfaces:**
- `RecordingAssistantCore.parseTurns(text, redFragments)` returns `{ turns, issues, fingerprint }`.
- Each turn is `{ label, text, pauseSeconds, hasRed, redText }`.
- `createSession(turns)`, `activatePrimary(state, now)`, and `advanceSession(state, now)` return immutable states with phases `reading`, `post-red`, `pause`, and `complete`.

- [ ] **Step 1: Write failing parsing tests.** Cover em-dash pause markers, a normal turn, a red turn mapped from `redFragments`, a missing pause issue, and a stable fingerprint. Expectations must use hand-written literal values.
- [ ] **Step 2: Verify RED.** Run `node --test tests/core.test.mjs`. Expected: module or API missing.
- [ ] **Step 3: Implement parsing only.** Attach the API to `globalThis.RecordingAssistantCore` so the same classic script works in Chrome and can be imported for test side effects.
- [ ] **Step 4: Verify GREEN.** Run `node --test tests/core.test.mjs`. Expected: parsing tests pass.
- [ ] **Step 5: Add failing state tests.** Prove ordinary turns enter their exact pause, red turns enter exactly 5000ms of `post-red`, primary activation is ignored during timers, late ticks preserve absolute deadlines, and the last pause ends in `complete`.
- [ ] **Step 6: Verify RED.** Run `node --test tests/core.test.mjs`. Expected: state API assertions fail.
- [ ] **Step 7: Implement the immutable state machine.** Timer transitions use carried deadlines rather than `now` so delayed frames do not lengthen either countdown.
- [ ] **Step 8: Verify GREEN and commit.** Run `node --test`; expected all tests pass. Commit `feat: add deterministic recording timer core`.

### Task 2: DOM discovery and native recorder docking

**Files:**
- Create: `extension/dom.js`
- Create: `tests/fixtures/platform.html`
- Create: `tests/dom-smoke.mjs`

**Interfaces:**
- `RecordingAssistantDom.scanPage(document)` returns `{ scriptRoot, turns, recorderRoot, issues }`.
- `dockRecorder(recorderRoot)` adds `data-era-recorder-docked="true"` to the original element and never clones or reparents it.

- [ ] **Step 1: Create an adversarial fixture and failing browser test.** The fixture contains a 5000px page, hidden duplicate script, delayed recorder area, red text using computed RGB color, and unrelated buttons containing the word “录音”. The test must prove the visible smallest script is selected and the exact recorder node identity survives docking.
- [ ] **Step 2: Verify RED.** Launch Chromium against the fixture and load `extension/dom.js`. Expected: `RecordingAssistantDom` is missing.
- [ ] **Step 3: Implement visible-node filtering, script-root scoring, red-fragment extraction, recorder-root scoring, and scoped docking.** No selector may depend solely on generated class names.
- [ ] **Step 4: Verify GREEN.** Run the DOM smoke test. Expected: script and recorder assertions pass.
- [ ] **Step 5: Add mutation tests.** Replace the recorder container and script subtree after load; expect rescanning to find the new nodes without retaining the old class.
- [ ] **Step 6: Verify RED then GREEN.** Implement the minimal rescan helpers, run the tests, then commit `feat: discover scripts and dock native recorder`.

### Task 3: Single-action floating overlay

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/content.js`
- Create: `extension/overlay.js`
- Create: `extension/overlay.css.js`
- Create: `extension/icons/icon16.png`
- Create: `extension/icons/icon32.png`
- Create: `extension/icons/icon48.png`
- Create: `extension/icons/icon128.png`
- Create: `tests/extension.spec.mjs`

**Interfaces:**
- Exactly one host with id `english-recording-assistant-root` is attached to the document.
- The host's closed Shadow DOM exposes user behavior through visible labels and `data-era-state` on the host.
- `Space` invokes the primary action only during `reading`, outside editable controls, when `event.repeat === false`.

- [ ] **Step 1: Write the failing extension test.** Load the unpacked extension in a persistent Chromium context, route the real host URL to the fixture, and assert the overlay, one-time instructions, ordinary-turn button, red-turn button, and live countdown behavior.
- [ ] **Step 2: Verify RED.** Expected: overlay selector is absent.
- [ ] **Step 3: Add the least-privilege manifest.** Match only `https://bytedance.aiforce.cloud/app/*`; request only `storage`; list `core.js`, `dom.js`, `overlay.css.js`, `overlay.js`, and `content.js` in dependency order.
- [ ] **Step 4: Implement the overlay and controller.** Render one primary action while reading, no action during either timer, absolute-time updates, compact/side preferences, one-time onboarding, reset, and an explicit scan failure state.
- [ ] **Step 5: Verify GREEN.** Run the extension test. Expected: all interaction assertions pass with zero page or extension errors.
- [ ] **Step 6: Commit.** Commit `feat: add floating recording pace assistant`.

### Task 4: Adversarial acceptance and distribution

**Files:**
- Modify: `tests/extension.spec.mjs`
- Create: `README.md`
- Create: `scripts/package-extension.ps1`
- Create: `docs/adversarial-acceptance.md`

- [ ] **Step 1: Add failing misuse tests.** Hold Space, send repeat keydowns, press Space inside input/contenteditable, double-inject content scripts, block the main thread for two seconds, and replace the SPA body during a timer. Each test names the incorrect production behavior it prevents.
- [ ] **Step 2: Verify RED and implement protections.** Fix only behaviors reproduced by the new tests; use absolute deadlines and singleton guards.
- [ ] **Step 3: Add viewport tests.** At top/middle/bottom scroll positions and 100%/125%/200% scaling, assert the overlay and real recorder bounding boxes stay inside the viewport and do not overlap.
- [ ] **Step 4: Verify RED and refine layout.** Apply minimal responsive changes, then rerun the complete browser suite.
- [ ] **Step 5: Document installation and real-platform acceptance.** Include Chrome/Edge load-unpacked steps, exact permissions, controls, troubleshooting, and a checklist for logged-in recording verification.
- [ ] **Step 6: Package reproducibly.** `scripts/package-extension.ps1` copies only the `extension` directory contents into `dist/english-recording-assistant.zip`; recordings and test artifacts are excluded.
- [ ] **Step 7: Run full verification.** Run `node --test`, the Playwright extension suite, validate `manifest.json`, inspect desktop screenshots, and inspect the ZIP file list. Expected: zero failures, zero console errors, and only declared extension resources in the package.
- [ ] **Step 8: Commit.** Commit `test: harden extension against recording misuse`.

## Review focus

The final review must deliberately challenge: timer shortening through repeated input, cumulative timer drift, duplicate overlays after SPA updates, docking the wrong “录音” button, cloning or replacing the platform recorder, broad host permissions, hidden network access, and UI overlap at long scroll positions or 200% scaling.

