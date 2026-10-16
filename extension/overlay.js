(() => {
  'use strict';

  const ROOT_ID = 'english-recording-assistant-root';

  function createElement(tag, className, attributes = {}) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    return element;
  }

  function createOverlay(callbacks) {
    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      return null;
    }

    const host = createElement('div', '', { id: ROOT_ID });
    host.dataset.eraState = 'loading';
    host.dataset.eraTurn = '0';
    host.dataset.eraCompact = 'false';
    host.dataset.eraRecorderExpanded = 'false';
    const shadow = host.attachShadow({ mode: 'open' });
    let layout = {
      defaultSide: 'right',
      position: null,
      compact: false,
      visible: true,
    };
    let dragState = null;
    let layoutReportQueued = false;

    function setHostStyle(name, value) {
      host.style.setProperty(name, value, 'important');
    }

    function syncHostLayout() {
      if (!layout.visible) {
        setHostStyle('display', 'none');
        return;
      }
      const narrow = window.innerWidth <= 900;
      const low = window.innerHeight <= 600;
      const width = low
        ? 'min(240px, calc(100vw - 24px))'
        : narrow
          ? 'min(286px, calc(100vw - 24px))'
          : layout.compact
            ? '260px'
            : 'min(312px, calc(100vw - 32px))';

      setHostStyle('display', 'block');
      setHostStyle('position', 'fixed');
      setHostStyle('box-sizing', 'border-box');
      setHostStyle('margin', '0');
      setHostStyle('padding', '0');
      setHostStyle('border', '0');
      setHostStyle('width', width);
      setHostStyle('min-width', '0');
      setHostStyle('max-width', 'none');
      setHostStyle('height', 'auto');
      setHostStyle('min-height', '0');
      setHostStyle('max-height', 'none');
      setHostStyle('visibility', 'visible');
      setHostStyle('opacity', '1');
      setHostStyle('overflow', 'visible');
      setHostStyle('pointer-events', 'auto');
      setHostStyle('clip', 'auto');
      setHostStyle('clip-path', 'none');
      setHostStyle('z-index', '2147483647');
      setHostStyle('bottom', 'auto');
      setHostStyle('right', 'auto');
      setHostStyle('transform', 'none');

      const rect = host.getBoundingClientRect();
      const margin = narrow || low ? 12 : 22;
      const fallback = {
        x: layout.defaultSide === 'left'
          ? margin
          : window.innerWidth - rect.width - margin,
        y: (window.innerHeight - rect.height) / 2,
      };
      const requested = layout.position ?? fallback;
      const resolved = {
        x: Math.min(
          Math.max(margin, requested.x),
          Math.max(margin, window.innerWidth - rect.width - margin),
        ),
        y: Math.min(
          Math.max(margin, requested.y),
          Math.max(margin, window.innerHeight - rect.height - margin),
        ),
      };
      setHostStyle('left', `${resolved.x}px`);
      setHostStyle('top', `${resolved.y}px`);
      return resolved;
    }

    function emitLayout() {
      if (!layout.visible) {
        return;
      }
      const rect = host.getBoundingClientRect();
      callbacks.onLayoutChange?.({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    }

    function syncAndReportLayout() {
      const resolved = syncHostLayout();
      if (resolved) {
        emitLayout();
      }
    }

    function queueLayoutReport() {
      if (layoutReportQueued) {
        return;
      }
      layoutReportQueued = true;
      queueMicrotask(() => {
        layoutReportQueued = false;
        syncAndReportLayout();
      });
    }

    const style = createElement('style');
    style.textContent = globalThis.RecordingAssistantOverlayStyles;

    const panel = createElement('section', 'panel', {
      'data-testid': 'panel',
      'aria-label': '英语录制节奏助手',
    });
    panel.innerHTML = `
      <p class="sr-only" data-testid="announcement" aria-live="polite"></p>
      <header class="header" data-drag-handle title="拖动标题栏移动">
        <span class="signal" aria-hidden="true"></span>
        <div class="brand"><strong>录制节奏</strong><span>PACE MONITOR</span></div>
        <button class="icon-button" data-action="recorder-size" type="button" aria-label="展开录音区" title="展开录音区">▤</button>
        <button class="icon-button" data-action="compact" type="button" aria-label="折叠面板" title="折叠面板">−</button>
        <button class="icon-button" data-action="close" type="button" aria-label="关闭助手" title="关闭；点击扩展图标可恢复">×</button>
      </header>
      <aside class="intro" data-testid="intro">
        <p>读完红词时点击主按钮或按 F8，无需先点击助手。倒计时期间继续朗读，归零后保持安静。</p>
        <button class="text-button" data-action="dismiss-intro" type="button">知道了</button>
      </aside>
      <div class="body">
        <div class="turn-line">
          <span data-testid="turn-label">正在扫描</span>
          <span class="recorder-state" data-testid="recorder-state" data-found="false">录音控件未出现</span>
        </div>
        <div class="stage" data-testid="stage">
          <p class="eyebrow" data-testid="eyebrow">准备中</p>
          <h2 class="title" data-testid="title">识别剧本…</h2>
          <p class="red-word" data-testid="red-word" hidden></p>
          <div class="timer" data-testid="timer" hidden>
            <span class="timer-value" data-testid="countdown">0.0</span>
          </div>
          <p class="note" data-testid="note">请稍候</p>
        </div>
        <button class="primary" data-action="primary" type="button" hidden></button>
      </div>
      <footer class="footer">
        <span>F8 = 当前主操作（全局）</span>
        <span class="footer-actions">
          <button class="text-button" data-action="rescan" type="button">重新扫描</button>
          <button class="text-button" data-action="reset" type="button">重置</button>
        </span>
      </footer>
    `;
    shadow.append(style, panel);
    document.documentElement.append(host);
    syncHostLayout();
    window.addEventListener('resize', syncAndReportLayout, { passive: true });

    const refs = {
      panel,
      header: shadow.querySelector('[data-drag-handle]'),
      announcement: shadow.querySelector('[data-testid="announcement"]'),
      intro: shadow.querySelector('[data-testid="intro"]'),
      turnLabel: shadow.querySelector('[data-testid="turn-label"]'),
      recorderState: shadow.querySelector('[data-testid="recorder-state"]'),
      eyebrow: shadow.querySelector('[data-testid="eyebrow"]'),
      title: shadow.querySelector('[data-testid="title"]'),
      redWord: shadow.querySelector('[data-testid="red-word"]'),
      timer: shadow.querySelector('[data-testid="timer"]'),
      countdown: shadow.querySelector('[data-testid="countdown"]'),
      note: shadow.querySelector('[data-testid="note"]'),
      primary: shadow.querySelector('[data-action="primary"]'),
      recorderSize: shadow.querySelector('[data-action="recorder-size"]'),
      compact: shadow.querySelector('[data-action="compact"]'),
      close: shadow.querySelector('[data-action="close"]'),
      rescan: shadow.querySelector('[data-action="rescan"]'),
      reset: shadow.querySelector('[data-action="reset"]'),
    };

    shadow.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) {
        return;
      }
      if (action === 'primary') callbacks.onPrimary();
      if (action === 'reset') callbacks.onReset();
      if (action === 'rescan') callbacks.onRescan();
      if (action === 'dismiss-intro') callbacks.onDismissIntro();
      if (action === 'recorder-size') callbacks.onToggleRecorderSize();
      if (action === 'compact') callbacks.onToggleCompact();
      if (action === 'close') callbacks.onClose();
    });

    refs.header.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) {
        return;
      }
      const rect = host.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: rect.left,
        originY: rect.top,
        moved: false,
      };
      refs.header.setPointerCapture(event.pointerId);
      host.dataset.eraDragging = 'true';
      event.preventDefault();
    });

    refs.header.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }
      const deltaX = event.clientX - dragState.pointerX;
      const deltaY = event.clientY - dragState.pointerY;
      if (!dragState.moved && Math.hypot(deltaX, deltaY) < 4) {
        return;
      }
      dragState.moved = true;
      layout.position = {
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      };
      const resolved = syncHostLayout();
      if (resolved) {
        layout.position = resolved;
        host.dataset.eraPositioned = 'true';
        callbacks.onPositionChange({ ...resolved }, false);
        emitLayout();
      }
    });

    function finishDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }
      if (refs.header.hasPointerCapture(event.pointerId)) {
        refs.header.releasePointerCapture(event.pointerId);
      }
      const moved = dragState.moved;
      dragState = null;
      host.dataset.eraDragging = 'false';
      if (moved && layout.position) {
        callbacks.onPositionChange({ ...layout.position }, true);
      }
    }

    refs.header.addEventListener('pointerup', finishDrag);
    refs.header.addEventListener('pointercancel', finishDrag);

    function render(model) {
      const {
        state,
        issues,
        recorderFound,
        onboardingVisible,
        defaultSide,
        position,
        compact,
        recorderExpanded,
        visible,
        now,
      } = model;
      const criticalIssue = issues.find((issue) => issue.code !== 'recorder-not-found');
      const turn = state.turns[state.turnIndex] ?? null;
      const timerRunning = !criticalIssue
        && (state.phase === 'post-red' || state.phase === 'pause');

      host.dataset.eraState = criticalIssue ? 'error' : state.phase;
      host.dataset.eraTurn = state.turnIndex >= 0 ? String(state.turnIndex + 1) : '0';
      host.dataset.eraCompact = String(compact);
      host.dataset.eraRecorderExpanded = String(recorderExpanded);
      if (!dragState) {
        layout = { defaultSide, position, compact, visible };
      } else {
        layout = { ...layout, defaultSide, compact, visible };
      }
      host.dataset.eraVisible = String(visible);
      host.dataset.eraPositioned = String(Boolean(layout.position));
      syncHostLayout();
      queueLayoutReport();
      refs.panel.dataset.state = criticalIssue ? 'error' : state.phase;
      refs.intro.hidden = !onboardingVisible;
      refs.compact.setAttribute('aria-label', compact ? '展开面板' : '折叠面板');
      refs.compact.textContent = compact ? '+' : '−';
      refs.recorderSize.hidden = !recorderFound;
      refs.recorderSize.setAttribute('aria-label', recorderExpanded ? '缩小录音区' : '展开录音区');
      refs.recorderSize.setAttribute('title', recorderExpanded ? '缩小录音区' : '展开录音区');
      refs.recorderSize.textContent = recorderExpanded ? '▥' : '▤';
      refs.rescan.disabled = timerRunning;
      refs.reset.disabled = timerRunning;
      refs.recorderState.dataset.found = String(recorderFound);
      refs.recorderState.textContent = recorderFound ? '录音控件已悬浮' : '录音控件未出现';
      refs.turnLabel.textContent = turn
        ? `${turn.label} · ${state.turnIndex + 1}/${state.turns.length}`
        : '未识别轮次';

      refs.redWord.hidden = true;
      refs.timer.hidden = true;
      refs.primary.hidden = true;
      refs.primary.replaceChildren();

      function announce(message) {
        if (refs.announcement.textContent !== message) {
          refs.announcement.textContent = message;
        }
      }

      if (criticalIssue) {
        announce(`无法识别剧本。${criticalIssue.message}`);
        refs.eyebrow.textContent = '需要检查';
        refs.title.textContent = '无法识别剧本';
        refs.note.textContent = criticalIssue.message;
        return;
      }

      if (state.phase === 'reading') {
        announce(turn.hasRed
          ? `${turn.label}，红词轮。读完红词后开始五秒。`
          : `${turn.label}，普通轮。读完本轮后开始静音。`);
        refs.eyebrow.textContent = turn.hasRed ? '红词轮' : '普通轮';
        refs.title.textContent = turn.hasRed ? '读完红词后' : '读完本轮后';
        refs.note.textContent = turn.hasRed
          ? '启动后继续朗读，5 秒归零自动静音'
          : `随后保持安静 ${turn.pauseSeconds} 秒`;
        if (turn.hasRed) {
          refs.redWord.hidden = false;
          refs.redWord.textContent = `“${turn.redText}”`;
        }
        refs.primary.hidden = false;
        refs.primary.append(
          document.createTextNode(turn.hasRed ? '开始 5 秒' : `开始静音 ${turn.pauseSeconds}s`),
        );
        const key = createElement('kbd');
        key.textContent = 'F8';
        refs.primary.append(key);
        return;
      }

      if (state.phase === 'post-red' || state.phase === 'pause') {
        announce(state.phase === 'post-red'
          ? '红词后计时。继续朗读。'
          : '句末静音。保持安静。');
        const remaining = globalThis.RecordingAssistantCore.remainingMs(state, now);
        const duration = state.phase === 'post-red' ? 5_000 : turn.pauseSeconds * 1_000;
        const progress = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
        refs.eyebrow.textContent = state.phase === 'post-red' ? '红词后计时' : '句末静音';
        refs.title.textContent = state.phase === 'post-red' ? '继续朗读' : '保持安静';
        refs.timer.hidden = false;
        refs.timer.style.setProperty('--progress', `${progress * 100}%`);
        refs.countdown.textContent = (remaining / 1_000).toFixed(1);
        refs.note.textContent = state.phase === 'post-red'
          ? '归零后自动进入静音，无需操作'
          : '倒计时结束后自动进入下一轮';
        return;
      }

      announce('全部轮次完成。请结束录音并回听。');
      refs.eyebrow.textContent = '全部轮次';
      refs.title.textContent = '本题节奏完成';
      refs.note.textContent = '请使用下方原平台按钮结束录音并回听';
    }

    return Object.freeze({ host, render });
  }

  globalThis.RecordingAssistantOverlay = Object.freeze({
    createOverlay,
    ROOT_ID,
  });
})();

