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
  let defaultSide = 'left';
  let position = null;
  let compact = false;
  let recorderExpanded = false;
  let visible = true;
  let rescanTimer = null;
  let animationSignature = null;

  function hasCriticalIssues(result) {
    return result.issues.some((issue) => issue.code !== 'recorder-not-found');
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
      recorderExpanded,
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

  function syncRecorderLayout(anchorRect = null) {
    if (!scan.recorderRoot) {
      return;
    }
    if (!visible) {
      dom.undockRecorder(scan.recorderRoot);
      return;
    }
    if (anchorRect) {
      dom.layoutRecorder(scan.recorderRoot, anchorRect, recorderExpanded);
      return;
    }
    dom.dockRecorder(scan.recorderRoot);
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
      if (visible) {
        dom.dockRecorder(nextScan.recorderRoot);
      } else {
        dom.undockRecorder(nextScan.recorderRoot);
      }
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
    onToggleRecorderSize: () => {
      recorderExpanded = !recorderExpanded;
      chrome.storage.local.set({ recorderExpanded });
      render();
    },
    onClose: () => {
      visible = false;
      syncRecorderLayout();
      render();
    },
    onPositionChange: (nextPosition, persist) => {
      position = nextPosition;
      if (persist) {
        chrome.storage.local.set({ position });
      }
    },
    onLayoutChange: (anchorRect) => {
      syncRecorderLayout(anchorRect);
    },
  });

  if (!assistant) {
    return;
  }

  if (scan.recorderRoot) {
    dom.dockRecorder(scan.recorderRoot);
  }

  chrome.storage.local.get(
    {
      onboardingSeen: false,
      side: 'left',
      position: null,
      compact: false,
      recorderExpanded: false,
    },
    (preferences) => {
      onboardingVisible = !preferences.onboardingSeen;
      defaultSide = preferences.side === 'right' ? 'right' : 'left';
      position = Number.isFinite(preferences.position?.x)
        && Number.isFinite(preferences.position?.y)
        ? { x: preferences.position.x, y: preferences.position.y }
        : null;
      compact = Boolean(preferences.compact);
      recorderExpanded = Boolean(preferences.recorderExpanded);
      render();
    },
  );

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'era-show-overlay') {
      return;
    }
    visible = true;
    syncRecorderLayout();
    render();
  });

  window.addEventListener('keydown', (event) => {
    if (
      event.code !== 'F8'
      || event.repeat
      || session.phase !== 'reading'
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
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

