(() => {
  'use strict';

  const SCRIPT_ELEMENTS = 'main, section, article, div';
  const RECORD_ACTION = /^(开始录音|开始录制|录音作答|开始作答|开始回答|暂停录音|继续录音|停止录音|停止录制|结束录音|结束录制|完成录音|完成录制|提交录音|重新录音|重录)$/;
  const TIMER_TEXT = /(?:^|\s)\d{1,2}:\d{2}(?:\s|$)/;
  const DOCK_ATTRIBUTE = 'data-era-recorder-docked';
  const DOCK_STYLE_ID = 'english-recording-assistant-recorder-style';

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function recorderActionText(element) {
    const candidates = [
      element.innerText,
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
    ].map(normalizeText);
    return candidates.find((text) => RECORD_ACTION.test(text)) ?? '';
  }

  function isVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) {
      return false;
    }
    if (element.closest('[hidden], [aria-hidden="true"]')) {
      return false;
    }
    const style = getComputedStyle(element);
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number.parseFloat(style.opacity || '1') > 0
      && element.getClientRects().length > 0;
  }

  function scriptScore(element) {
    if (!isVisible(element)) {
      return null;
    }
    const text = element.innerText?.trim() ?? '';
    if (text.length === 0 || text.length > 50_000) {
      return null;
    }
    const turnCount = text.match(/轮次\s*\d+\s*[:：]?/g)?.length ?? 0;
    const pauseCount = text.match(/[—–─-]{2,}\s*\d+(?:\.\d+)?\s*s/gi)?.length ?? 0;
    if (turnCount === 0 || pauseCount === 0) {
      return null;
    }
    return {
      element,
      completeTurns: Math.min(turnCount, pauseCount),
      turnCount,
      textLength: text.length,
      depth: element.querySelectorAll('*').length,
    };
  }

  function findScriptRoot(documentRoot) {
    const candidates = [...documentRoot.querySelectorAll(SCRIPT_ELEMENTS)]
      .map(scriptScore)
      .filter(Boolean)
      .sort((left, right) => (
        right.completeTurns - left.completeTurns
        || right.turnCount - left.turnCount
        || left.textLength - right.textLength
        || left.depth - right.depth
      ));
    return candidates[0]?.element ?? null;
  }

  function parseRgb(color) {
    const values = String(color).match(/[\d.]+/g)?.map(Number) ?? [];
    return values.length >= 3 ? values.slice(0, 3) : null;
  }

  function isRedColor(color) {
    const rgb = parseRgb(color);
    if (!rgb) {
      return false;
    }
    const [red, green, blue] = rgb;
    return red >= 150 && red - green >= 55 && red - blue >= 45;
  }

  function extractRedFragments(scriptRoot) {
    if (!scriptRoot) {
      return [];
    }
    const fragments = [];
    for (const element of scriptRoot.querySelectorAll('*')) {
      if (!isVisible(element) || !isRedColor(getComputedStyle(element).color)) {
        continue;
      }
      const parent = element.parentElement;
      if (parent && scriptRoot.contains(parent) && isRedColor(getComputedStyle(parent).color)) {
        continue;
      }
      const text = normalizeText(element.innerText || element.textContent);
      if (text && !fragments.includes(text)) {
        fragments.push(text);
      }
    }
    return fragments;
  }

  function recorderContainerFor(control) {
    let candidate = control.parentElement;
    let fallback = candidate;
    for (let level = 0; candidate && level < 6; level += 1) {
      if (!isVisible(candidate) || candidate === document.body) {
        break;
      }
      const text = normalizeText(candidate.innerText);
      if (TIMER_TEXT.test(` ${text} `) && text.length <= 300) {
        return candidate;
      }
      fallback = candidate;
      candidate = candidate.parentElement;
    }
    return fallback && normalizeText(fallback.innerText).length <= 300 ? fallback : control;
  }

  function findRecorderRoot(documentRoot) {
    const controls = [...documentRoot.querySelectorAll('button, [role="button"]')]
      .filter(isVisible)
      .filter((element) => recorderActionText(element));

    const candidates = controls
      .map((control) => {
        const container = recorderContainerFor(control);
        const text = normalizeText(container.innerText);
        return {
          container,
          hasTimer: TIMER_TEXT.test(` ${text} `),
          textLength: text.length,
        };
      })
      .filter((candidate) => candidate.hasTimer);

    candidates.sort((left, right) => (
      Number(right.hasTimer) - Number(left.hasTimer)
      || left.textLength - right.textLength
    ));
    return candidates[0]?.container ?? null;
  }

  function ensureDockStyle(documentRoot) {
    if (documentRoot.getElementById(DOCK_STYLE_ID)) {
      return;
    }
    const style = documentRoot.createElement('style');
    style.id = DOCK_STYLE_ID;
    style.textContent = `
      [${DOCK_ATTRIBUTE}="true"] {
        position: fixed !important;
        inset: auto auto 18px 50% !important;
        transform: translateX(-50%) !important;
        z-index: 2147483000 !important;
        width: min(720px, calc(100vw - 36px)) !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        border: 1px solid rgba(19, 33, 47, 0.12) !important;
        border-radius: 18px !important;
        background: rgba(255, 255, 255, 0.97) !important;
        box-shadow: 0 18px 54px rgba(19, 33, 47, 0.18) !important;
        backdrop-filter: blur(16px) !important;
      }
    `;
    (documentRoot.head || documentRoot.documentElement).append(style);
  }

  function dockRecorder(recorderRoot) {
    if (!recorderRoot) {
      return null;
    }
    const documentRoot = recorderRoot.ownerDocument;
    ensureDockStyle(documentRoot);
    for (const previous of documentRoot.querySelectorAll(`[${DOCK_ATTRIBUTE}="true"]`)) {
      if (previous !== recorderRoot) {
        previous.removeAttribute(DOCK_ATTRIBUTE);
      }
    }
    recorderRoot.setAttribute(DOCK_ATTRIBUTE, 'true');
    return recorderRoot;
  }

  function scanPage(documentRoot) {
    const issues = [];
    const scriptRoot = findScriptRoot(documentRoot);
    let turns = [];
    let fingerprint = null;

    if (!scriptRoot) {
      issues.push({
        code: 'script-not-found',
        message: '未识别到包含轮次和静音时长的剧本。',
      });
    } else {
      const parsed = globalThis.RecordingAssistantCore.parseTurns(
        scriptRoot.innerText,
        extractRedFragments(scriptRoot),
      );
      turns = parsed.turns;
      fingerprint = parsed.fingerprint;
      issues.push(...parsed.issues);
    }

    const recorderRoot = findRecorderRoot(documentRoot);
    if (!recorderRoot) {
      issues.push({
        code: 'recorder-not-found',
        message: '尚未发现原平台录音控件。',
      });
    }

    return {
      scriptRoot,
      turns,
      fingerprint,
      recorderRoot,
      issues,
    };
  }

  globalThis.RecordingAssistantDom = Object.freeze({
    scanPage,
    dockRecorder,
    isVisible,
  });
})();

