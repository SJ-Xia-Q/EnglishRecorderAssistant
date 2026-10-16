(() => {
  'use strict';

  const SCRIPT_ELEMENTS = 'main, section, article, div';
  const RECORD_ACTION = /^(点击开始录音|点击开始录制|开始录音|开始录制|录音作答|开始作答|开始回答|暂停录音|继续录音|停止录音|停止录制|结束录音|结束录制|完成录音|完成录制|提交录音|重新录音|重录)$/;
  const TIMER_TEXT = /(?:^|\s)\d{1,2}:\d{2}(?:\s*\/\s*\d{1,2}:\d{2})?(?=\s|$)/;
  const RECORDER_HEADING = /(用户录音|录音作答|音频录制)/;
  const PENDING_RECORDER_STATE = /(待录制|未录制|准备录音)/;
  const PENDING_RECORDER_PROMPT = /(点击|按下)?\s*(开始录音|开始录制)/;
  const DOCK_ATTRIBUTE = 'data-era-recorder-docked';
  const DOCK_SIZE_ATTRIBUTE = 'data-era-recorder-size';
  const DOCK_PLACEMENT_ATTRIBUTE = 'data-era-recorder-placement';
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
    if (candidates[0]) {
      return candidates[0].container;
    }

    const pendingCandidates = [...documentRoot.querySelectorAll('section, article, div')]
      .filter(isVisible)
      .map((element) => {
        const text = normalizeText(element.innerText);
        const hasVisibleControl = [...element.querySelectorAll('button, [role="button"]')]
          .some(isVisible);
        if (
          text.length === 0
          || text.length > 500
          || !hasVisibleControl
          || !RECORDER_HEADING.test(text)
          || !PENDING_RECORDER_STATE.test(text)
          || !PENDING_RECORDER_PROMPT.test(text)
        ) {
          return null;
        }
        return {
          element,
          textLength: text.length,
          depth: element.querySelectorAll('*').length,
        };
      })
      .filter(Boolean)
      .sort((left, right) => (
        left.textLength - right.textLength
        || left.depth - right.depth
      ));

    return pendingCandidates[0]?.element ?? null;
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
        inset: var(--era-recorder-top) auto auto var(--era-recorder-left) !important;
        transform: none !important;
        z-index: 2147483000 !important;
        width: var(--era-recorder-width) !important;
        min-width: 0 !important;
        max-width: none !important;
        min-height: 0 !important;
        max-height: var(--era-recorder-max-height) !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        overflow: auto !important;
        overscroll-behavior: contain !important;
        border: 1px solid rgba(19, 33, 47, 0.12) !important;
        border-radius: 18px !important;
        background: rgba(255, 255, 255, 0.97) !important;
        box-shadow: 0 18px 54px rgba(19, 33, 47, 0.18) !important;
        backdrop-filter: blur(16px) !important;
      }
    `;
    (documentRoot.head || documentRoot.documentElement).append(style);
  }

  function clearDockProperties(recorderRoot) {
    for (const property of [
      '--era-recorder-left',
      '--era-recorder-top',
      '--era-recorder-width',
      '--era-recorder-max-height',
    ]) {
      recorderRoot.style.removeProperty(property);
    }
  }

  function undockRecorder(recorderRoot) {
    if (!recorderRoot) {
      return null;
    }
    recorderRoot.removeAttribute(DOCK_ATTRIBUTE);
    recorderRoot.removeAttribute(DOCK_SIZE_ATTRIBUTE);
    recorderRoot.removeAttribute(DOCK_PLACEMENT_ATTRIBUTE);
    clearDockProperties(recorderRoot);
    return recorderRoot;
  }

  function dockRecorder(recorderRoot) {
    if (!recorderRoot) {
      return null;
    }
    const documentRoot = recorderRoot.ownerDocument;
    ensureDockStyle(documentRoot);
    for (const previous of documentRoot.querySelectorAll(`[${DOCK_ATTRIBUTE}="true"]`)) {
      if (previous !== recorderRoot) {
        undockRecorder(previous);
      }
    }
    recorderRoot.setAttribute(DOCK_ATTRIBUTE, 'true');
    return recorderRoot;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function setDockProperty(recorderRoot, property, value) {
    if (recorderRoot.style.getPropertyValue(property) !== value) {
      recorderRoot.style.setProperty(property, value);
    }
  }

  function layoutRecorder(recorderRoot, anchorRect, expanded = false) {
    if (!recorderRoot || !anchorRect) {
      return null;
    }
    dockRecorder(recorderRoot);
    const documentRoot = recorderRoot.ownerDocument;
    const viewport = documentRoot.defaultView;
    const viewportWidth = viewport.innerWidth;
    const viewportHeight = viewport.innerHeight;
    const low = viewportHeight <= 600;
    const margin = viewportWidth <= 900 || low ? 12 : 22;
    const gap = 10;
    const bottomActionReserve = low ? 84 : 0;
    const desiredHeight = expanded ? 360 : 180;
    const placement = 'below';
    const width = Math.min(anchorRect.width, viewportWidth - (margin * 2));
    const availableHeight = Math.max(
      0,
      viewportHeight - bottomActionReserve - margin - anchorRect.bottom - gap,
    );
    const maxHeight = Math.min(desiredHeight, availableHeight);
    const left = clamp(anchorRect.left, margin, viewportWidth - margin - width);
    const top = anchorRect.bottom + gap;

    recorderRoot.setAttribute(DOCK_SIZE_ATTRIBUTE, expanded ? 'expanded' : 'compact');
    setDockProperty(recorderRoot, '--era-recorder-width', `${Math.round(width)}px`);
    setDockProperty(recorderRoot, '--era-recorder-max-height', `${Math.round(maxHeight)}px`);

    recorderRoot.setAttribute(DOCK_PLACEMENT_ATTRIBUTE, placement);
    setDockProperty(recorderRoot, '--era-recorder-left', `${Math.round(left)}px`);
    setDockProperty(recorderRoot, '--era-recorder-top', `${Math.round(top)}px`);
    return {
      placement,
      size: expanded ? 'expanded' : 'compact',
      left,
      top,
      width,
      maxHeight,
    };
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
    layoutRecorder,
    undockRecorder,
    isVisible,
  });
})();

