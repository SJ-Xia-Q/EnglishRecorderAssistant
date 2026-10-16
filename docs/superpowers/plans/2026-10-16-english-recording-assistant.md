# English Recording Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first recording page that guides the red-word 5-second reading window and each turn's required silence, then exports the recording.

**Architecture:** A static ES-module application separates script parsing, deterministic session timing, browser recording, and DOM rendering. Pure modules are covered by Node's built-in test runner; browser behavior is verified with Playwright against a local zero-dependency server.

**Tech Stack:** HTML5, CSS, vanilla JavaScript ES modules, Node.js built-in test runner and HTTP server, browser MediaRecorder/Web Audio APIs, Playwright for UI verification.

**Spec:** `docs/plans/2026-10-16-english-recording-assistant-design.md`

---

### Task 1: Script rules and red-word coverage analysis

**Files:**
- Create: `package.json`
- Create: `tests/rules.test.mjs`
- Create: `js/rules.mjs`

**Interface:**
- `parseScript(source)` returns `{ turns, issues }`; every turn contains `label`, `segments`, `plainText`, `pauseSeconds`, and `redCues`.
- `assessRedCue(turn, cueIndex, speechRateWpm = 150)` returns `enough`, `slow`, or `review`, a literal remaining-word count, estimated seconds, target WPM, and an optional approximate stop word.

- [ ] Write failing tests proving markup parsing, pause extraction, sentence-boundary crossing inside one turn, no crossing into the next turn, and the three coverage statuses.
- [ ] Run `node --test tests/rules.test.mjs`; expect failure because `js/rules.mjs` does not exist.
- [ ] Implement marker tokenization, turn parsing, English word extraction, and coverage assessment.
- [ ] Run `node --test tests/rules.test.mjs`; expect all tests to pass with no warnings.

### Task 2: Deterministic recording-session timing

**Files:**
- Create: `tests/session.test.mjs`
- Create: `js/session.mjs`

**Interface:**
- `createSession(turns)` returns an idle immutable session state.
- `startSession`, `triggerRedCue`, `completeTurn`, and `advanceSession` return new states.
- Phases are `idle`, `reading`, `post-red`, `pause`, and `finished`; deadlines are absolute millisecond timestamps.

- [ ] Write failing tests for a 5,000 ms post-red window, automatic pause entry, ordinary-turn completion, late timer ticks, final completion, and rejection of early completion during the post-red window.
- [ ] Run `node --test tests/session.test.mjs`; expect failure because `js/session.mjs` does not exist.
- [ ] Implement the minimum immutable state machine, preserving exact deadlines when late ticks cross phase boundaries.
- [ ] Run `node --test tests/session.test.mjs`; expect all tests to pass.
- [ ] Run `node --test`; expect the whole logic suite to pass.

### Task 3: Recorder and WAV export

**Files:**
- Create: `tests/wav.test.mjs`
- Create: `js/recorder.mjs`

**Interface:**
- `encodeWav(audioBuffer)` returns a standards-compliant 16-bit PCM WAV `ArrayBuffer`.
- `BrowserRecorder` exposes `prepare`, `start`, `stop`, and `discard`, plus analyser data for the live meter.

- [ ] Write a failing test that validates RIFF/WAVE headers, sample rate, channel count, data length, and PCM clamping using a small real fixture object.
- [ ] Run `node --test tests/wav.test.mjs`; expect failure because `js/recorder.mjs` does not exist.
- [ ] Implement WAV encoding and the MediaRecorder lifecycle with native-format fallback when browser decoding fails.
- [ ] Run `node --test tests/wav.test.mjs`; expect all tests to pass.
- [ ] Run `node --test`; expect the whole suite to pass.

### Task 4: Recording-console interface

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `js/app.mjs`
- Create: `server.mjs`
- Create: `README.md`
- Create: `tests/ui-smoke.py`

**Interface:**
- The UI consumes Tasks 1–3 only through their exported functions/classes.
- Stable browser-test hooks are semantic labels and `data-testid` attributes for phase, turn number, countdown, editor, risk summary, and download link.

- [ ] Write the Playwright smoke script first; it must require the initial five-turn example, open the editor, save a risky short red-word script, expose the review warning, start demo mode without microphone, trigger the red timer, and advance to pause.
- [ ] Run the smoke script against an empty server page; expect selector failure for the missing application.
- [ ] Implement the semantic HTML shell, responsive studio-console styling, script editor, preflight panel, keyboard controls, deterministic rendering loop, microphone recorder integration, demo mode, playback, download, and local script persistence.
- [ ] Run the Playwright smoke script; expect all assertions to pass with no console errors.
- [ ] Capture desktop and mobile screenshots and visually inspect text overflow, controls, timer legibility, and focus states.
- [ ] Run `node --test`; expect all logic tests to pass.

### Task 5: Final verification and handoff

**Files:**
- Modify only files implicated by verified defects.

- [ ] Run `node --test` and record the passing test count.
- [ ] Run the full Playwright smoke test against `node server.mjs` and record the passing checks.
- [ ] Start the app, request microphone permission, make a short recording, stop it, and verify a playable downloadable result when the environment exposes an input device; otherwise report that physical-device check as unavailable.
- [ ] Review the rendered desktop and mobile screenshots against the design and fix important visual or accessibility defects through test-first changes.
- [ ] Re-read the source requirement and design spec line by line, verifying every requested rule has a corresponding behavior or explicit warning.

