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
    host.dataset.eraSide = 'right';
    host.dataset.eraCompact = 'false';
    host.setAttribute('aria-live', 'polite');
    const shadow = host.attachShadow({ mode: 'open' });

    const style = createElement('style');
    style.textContent = globalThis.RecordingAssistantOverlayStyles;

    const panel = createElement('section', 'panel', {
      'data-testid': 'panel',
      'aria-label': '英语录制节奏助手',
    });
    panel.innerHTML = `
      <header class="header">
        <span class="signal" aria-hidden="true"></span>
        <div class="brand"><strong>录制节奏</strong><span>PACE MONITOR</span></div>
        <button class="icon-button" data-action="side" type="button" aria-label="切换到左侧" title="切换左右位置">⇄</button>
        <button class="icon-button" data-action="compact" type="button" aria-label="折叠面板" title="折叠面板">−</button>
      </header>
      <aside class="intro" data-testid="intro">
        <p>读完红词时点击主按钮或按 Space。倒计时期间继续朗读，归零后保持安静。</p>
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
        <span>Space = 当前主操作</span>
        <span class="footer-actions">
          <button class="text-button" data-action="rescan" type="button">重新扫描</button>
          <button class="text-button" data-action="reset" type="button">重置</button>
        </span>
      </footer>
    `;
    shadow.append(style, panel);
    document.documentElement.append(host);

    const refs = {
      panel,
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
      side: shadow.querySelector('[data-action="side"]'),
      compact: shadow.querySelector('[data-action="compact"]'),
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
      if (action === 'side') callbacks.onToggleSide();
      if (action === 'compact') callbacks.onToggleCompact();
    });

    function render(model) {
      const {
        state,
        issues,
        recorderFound,
        onboardingVisible,
        side,
        compact,
        now,
      } = model;
      const criticalIssue = issues.find((issue) => issue.code !== 'recorder-not-found');
      const turn = state.turns[state.turnIndex] ?? null;

      host.dataset.eraState = criticalIssue ? 'error' : state.phase;
      host.dataset.eraTurn = state.turnIndex >= 0 ? String(state.turnIndex + 1) : '0';
      host.dataset.eraSide = side;
      host.dataset.eraCompact = String(compact);
      refs.panel.dataset.state = criticalIssue ? 'error' : state.phase;
      refs.intro.hidden = !onboardingVisible;
      refs.side.setAttribute('aria-label', side === 'right' ? '切换到左侧' : '切换到右侧');
      refs.compact.setAttribute('aria-label', compact ? '展开面板' : '折叠面板');
      refs.compact.textContent = compact ? '+' : '−';
      refs.recorderState.dataset.found = String(recorderFound);
      refs.recorderState.textContent = recorderFound ? '录音控件已悬浮' : '录音控件未出现';
      refs.turnLabel.textContent = turn
        ? `${turn.label} · ${state.turnIndex + 1}/${state.turns.length}`
        : '未识别轮次';

      refs.redWord.hidden = true;
      refs.timer.hidden = true;
      refs.primary.hidden = true;
      refs.primary.replaceChildren();

      if (criticalIssue) {
        refs.eyebrow.textContent = '需要检查';
        refs.title.textContent = '无法识别剧本';
        refs.note.textContent = criticalIssue.message;
        return;
      }

      if (state.phase === 'reading') {
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
        key.textContent = 'Space';
        refs.primary.append(key);
        return;
      }

      if (state.phase === 'post-red' || state.phase === 'pause') {
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

