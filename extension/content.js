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
  let defaultSide = 'right';
  let position = null;
  let compact = false;
  let visible = true;
  let rescanTimer = null;
  let animationSignature = null;

  function hasCriticalIssues(result) {
    return result.issues.some((issue) => issue.code !== 'recorder-not-found');
  }

  function shortcutBlockedTarget(event) {
    return event.composedPath().some((node) => (
      node instanceof HTMLElement
      && (
        node.matches([
          'input',
          'textarea',
          'select',
          'button',
          'a[href]',
          'summary',
          '[role="button"]',
          '[contenteditable]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', '))
        || node.isContentEditable
      )
    ));
  }

  function render(now = performance.now()) {
    assistant.render({
      state: session,
      issues: scan.issues,
      recorderFound: Boolean(scan.recorderRoot),
      onboardingVisible,
      defaultSide,
      position,
      compact,
      visible,
      now,
    });
  }

  function primaryAction() {
    if (hasCriticalIssues(scan)) {
      return;
    }
    const next = core.activatePrimary(session, performance.now());
    if (next !== session) {
      session = next;
      render();
    }
  }

  function timerRunning() {
    return session.phase === 'post-red' || session.phase === 'pause';
  }

  function resetSession() {
    if (timerRunning()) {
      return;
    }
    session = core.createSession(scan.turns);
    render();
  }

  function applyScan(nextScan, forceReset = false) {
    if (nextScan.recorderRoot) {
      dom.dockRecorder(nextScan.recorderRoot);
    }
    const scriptTemporarilyMissing = nextScan.issues.some(
      (issue) => issue.code === 'script-not-found',
    );
    if (!forceReset && timerRunning() && scan.fingerprint && scriptTemporarilyMissing) {
      const recorderIssue = nextScan.issues.find(
        (issue) => issue.code === 'recorder-not-found',
      );
      scan = {
        ...scan,
        recorderRoot: nextScan.recorderRoot,
        issues: [
          ...scan.issues.filter((issue) => issue.code !== 'recorder-not-found'),
          ...(recorderIssue ? [recorderIssue] : []),
        ],
      };
      render();
      return;
    }
    const taskChanged = nextScan.fingerprint && nextScan.fingerprint !== scan.fingerprint;
    scan = nextScan;
    if (forceReset || taskChanged || hasCriticalIssues(scan)) {
      session = core.createSession(scan.turns);
    }
    render();
  }

  function rescan(forceReset = false) {
    if (forceReset && timerRunning()) {
      return;
    }
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
    onToggleCompact: () => {
      compact = !compact;
      chrome.storage.local.set({ compact });
      render();
    },
    onClose: () => {
      visible = false;
      render();
    },
    onPositionChange: (nextPosition, persist) => {
      position = nextPosition;
      if (persist) {
        chrome.storage.local.set({ position });
      }
    },
  });

  if (!assistant) {
    return;
  }

  if (scan.recorderRoot) {
    dom.dockRecorder(scan.recorderRoot);
  }

  chrome.storage.local.get(
    { onboardingSeen: false, side: 'right', position: null, compact: false },
    (preferences) => {
      onboardingVisible = !preferences.onboardingSeen;
      defaultSide = preferences.side === 'left' ? 'left' : 'right';
      position = Number.isFinite(preferences.position?.x)
        && Number.isFinite(preferences.position?.y)
        ? { x: preferences.position.x, y: preferences.position.y }
        : null;
      compact = Boolean(preferences.compact);
      render();
    },
  );

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'era-show-overlay') {
      return;
    }
    visible = true;
    render();
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.code !== 'Space'
      || event.repeat
      || session.phase !== 'reading'
      || shortcutBlockedTarget(event)
    ) {
      return;
    }
    event.preventDefault();
    primaryAction();
  }, true);

  const observer = new MutationObserver(() => {
    if (rescanTimer !== null) {
      return;
    }
    rescanTimer = setTimeout(() => {
      rescanTimer = null;
      rescan(false);
    }, 180);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
  });

  function animationFrame(now) {
    const next = core.advanceSession(session, now);
    if (next !== session) {
      session = next;
    }
    const timerBucket = session.deadline === null
      ? '-'
      : Math.round(core.remainingMs(session, now) / 100);
    const signature = [
      session.phase,
      session.turnIndex,
      session.deadline ?? '-',
      timerBucket,
    ].join(':');
    if (signature !== animationSignature) {
      animationSignature = signature;
      render(now);
    }
    requestAnimationFrame(animationFrame);
  }

  render();
  requestAnimationFrame(animationFrame);
})();

