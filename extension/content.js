(() => {
  'use strict';

  const { RecordingAssistantCore: core } = globalThis;
  const { RecordingAssistantDom: dom } = globalThis;
  const { RecordingAssistantOverlay: overlayApi } = globalThis;

  if (!core || !dom || !overlayApi || document.getElementById(overlayApi.ROOT_ID)) {
    return;
  }

  let scan = dom.scanPage(document);
  let session = core.createSession(scan.turns);
  let onboardingVisible = true;
  let side = 'right';
  let compact = false;
  let rescanTimer = null;

  function hasCriticalIssues(result) {
    return result.issues.some((issue) => issue.code !== 'recorder-not-found');
  }

  function editableTarget(event) {
    return event.composedPath().some((node) => (
      node instanceof HTMLElement
      && (node.matches('input, textarea, select') || node.isContentEditable)
    ));
  }

  function render(now = performance.now()) {
    assistant.render({
      state: session,
      issues: scan.issues,
      recorderFound: Boolean(scan.recorderRoot),
      onboardingVisible,
      side,
      compact,
      now,
    });
  }

  function primaryAction() {
    const next = core.activatePrimary(session, performance.now());
    if (next !== session) {
      session = next;
      render();
    }
  }

  function resetSession() {
    session = core.createSession(scan.turns);
    render();
  }

  function applyScan(nextScan, forceReset = false) {
    if (nextScan.recorderRoot) {
      dom.dockRecorder(nextScan.recorderRoot);
    }
    const taskChanged = nextScan.fingerprint && nextScan.fingerprint !== scan.fingerprint;
    scan = nextScan;
    if (forceReset || taskChanged || hasCriticalIssues(scan)) {
      session = core.createSession(scan.turns);
    }
    render();
  }

  function rescan(forceReset = false) {
    applyScan(dom.scanPage(document), forceReset);
  }

  const assistant = overlayApi.createOverlay({
    onPrimary: primaryAction,
    onReset: resetSession,
    onRescan: () => rescan(true),
    onDismissIntro: () => {
      onboardingVisible = false;
      chrome.storage.local.set({ onboardingSeen: true });
      render();
    },
    onToggleSide: () => {
      side = side === 'right' ? 'left' : 'right';
      chrome.storage.local.set({ side });
      render();
    },
    onToggleCompact: () => {
      compact = !compact;
      chrome.storage.local.set({ compact });
      render();
    },
  });

  if (!assistant) {
    return;
  }

  if (scan.recorderRoot) {
    dom.dockRecorder(scan.recorderRoot);
  }

  chrome.storage.local.get(
    { onboardingSeen: false, side: 'right', compact: false },
    (preferences) => {
      onboardingVisible = !preferences.onboardingSeen;
      side = preferences.side === 'left' ? 'left' : 'right';
      compact = Boolean(preferences.compact);
      render();
    },
  );

  document.addEventListener('keydown', (event) => {
    if (
      event.code !== 'Space'
      || event.repeat
      || session.phase !== 'reading'
      || editableTarget(event)
    ) {
      return;
    }
    event.preventDefault();
    primaryAction();
  }, true);

  const observer = new MutationObserver(() => {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => rescan(false), 120);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function animationFrame(now) {
    const next = core.advanceSession(session, now);
    if (next !== session) {
      session = next;
    }
    render(now);
    requestAnimationFrame(animationFrame);
  }

  render();
  requestAnimationFrame(animationFrame);
})();

