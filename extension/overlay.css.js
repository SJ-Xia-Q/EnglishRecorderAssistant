(() => {
  'use strict';

  globalThis.RecordingAssistantOverlayStyles = `
    :host {
      --era-ink: #14232d;
      --era-muted: #66717a;
      --era-paper: #f7f3eb;
      --era-paper-strong: #fffdf8;
      --era-line: rgba(20, 35, 45, 0.13);
      --era-signal: #d84a3f;
      --era-signal-dark: #a93029;
      --era-calm: #19785a;
      --era-shadow: 0 24px 70px rgba(18, 31, 40, 0.22), 0 3px 14px rgba(18, 31, 40, 0.1);
      position: fixed;
      top: 50%;
      right: 22px;
      z-index: 2147483100;
      width: min(312px, calc(100vw - 32px));
      transform: translateY(-50%);
      color: var(--era-ink);
      font-family: "Bahnschrift", "Microsoft YaHei UI", sans-serif;
      font-size: 14px;
      line-height: 1.45;
      color-scheme: light;
    }

    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .panel {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.75);
      border-radius: 24px;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(247, 243, 235, 0.97)),
        var(--era-paper);
      box-shadow: var(--era-shadow);
      backdrop-filter: blur(18px);
    }

    .panel::before {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: var(--era-signal);
    }

    .panel[data-state="pause"]::before { background: var(--era-calm); }
    .panel[data-state="complete"]::before { background: var(--era-ink); }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 17px 18px 12px;
      border-bottom: 1px solid var(--era-line);
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    :host([data-era-dragging="true"]) .header { cursor: grabbing; }

    .signal {
      width: 10px;
      height: 10px;
      border: 2px solid var(--era-paper-strong);
      border-radius: 50%;
      background: var(--era-signal);
      box-shadow: 0 0 0 1px rgba(20, 35, 45, 0.18);
    }

    .brand { min-width: 0; flex: 1; }
    .brand strong { display: block; font-size: 13px; letter-spacing: .04em; }
    .brand span { color: var(--era-muted); font-size: 11px; letter-spacing: .08em; }

    .icon-button {
      display: grid;
      width: 30px;
      height: 30px;
      place-items: center;
      border: 1px solid var(--era-line);
      border-radius: 9px;
      color: var(--era-ink);
      background: rgba(255, 255, 255, 0.66);
      cursor: pointer;
    }

    .icon-button:hover { background: white; }
    .icon-button:focus-visible, .primary:focus-visible, .text-button:focus-visible {
      outline: 3px solid rgba(216, 74, 63, 0.28);
      outline-offset: 2px;
    }

    .intro {
      margin: 14px 16px 0;
      padding: 12px 13px;
      border: 1px solid rgba(216, 74, 63, 0.2);
      border-radius: 14px;
      background: rgba(216, 74, 63, 0.07);
    }

    .intro[hidden] { display: none; }
    .intro p { margin: 0 0 8px; color: #503a36; font-size: 12px; }

    .text-button {
      padding: 0;
      border: 0;
      color: var(--era-signal-dark);
      background: transparent;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .text-button:disabled {
      color: var(--era-muted);
      opacity: 0.5;
      cursor: not-allowed;
    }

    .body { padding: 18px; }

    .turn-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      color: var(--era-muted);
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .recorder-state {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      letter-spacing: 0;
      text-transform: none;
    }

    .recorder-state::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #b8a15b;
    }

    .recorder-state[data-found="true"]::before { background: var(--era-calm); }

    .stage {
      min-height: 170px;
      display: grid;
      align-content: center;
      justify-items: center;
      text-align: center;
    }

    .eyebrow {
      margin: 0 0 6px;
      color: var(--era-signal-dark);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .13em;
    }

    .title {
      margin: 0;
      font-family: "Palatino Linotype", "STSong", serif;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.18;
      letter-spacing: -.02em;
    }

    .red-word {
      max-width: 100%;
      margin: 10px 0 0;
      overflow: hidden;
      color: var(--era-signal);
      font-family: Georgia, "Times New Roman", serif;
      font-size: 18px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .timer {
      --progress: 100%;
      display: grid;
      width: 132px;
      height: 132px;
      margin: 2px 0 9px;
      place-items: center;
      border-radius: 50%;
      background: conic-gradient(var(--era-signal) var(--progress), rgba(20, 35, 45, 0.1) 0);
    }

    .timer[hidden] { display: none; }

    .panel[data-state="pause"] .timer {
      background: conic-gradient(var(--era-calm) var(--progress), rgba(20, 35, 45, 0.1) 0);
    }

    .timer::before {
      content: "";
      grid-area: 1 / 1;
      width: 108px;
      height: 108px;
      border-radius: 50%;
      background: var(--era-paper-strong);
      box-shadow: inset 0 0 0 1px var(--era-line);
    }

    .timer-value {
      position: relative;
      grid-area: 1 / 1;
      font-family: "Bahnschrift", sans-serif;
      font-size: 38px;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      letter-spacing: -.05em;
    }

    .note { margin: 8px 0 0; color: var(--era-muted); font-size: 12px; }

    .primary {
      width: 100%;
      min-height: 52px;
      margin-top: 17px;
      padding: 10px 14px;
      border: 0;
      border-radius: 15px;
      color: white;
      background: var(--era-signal);
      box-shadow: 0 8px 22px rgba(169, 48, 41, 0.22);
      font-weight: 700;
      cursor: pointer;
      transition: transform 140ms ease, background 140ms ease;
    }

    .primary:hover { background: var(--era-signal-dark); transform: translateY(-1px); }
    .primary[hidden] { display: none; }
    .primary kbd {
      margin-left: 8px;
      padding: 3px 7px;
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.12);
      font-family: inherit;
      font-size: 10px;
      font-weight: 500;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 11px 18px 14px;
      border-top: 1px solid var(--era-line);
      color: var(--era-muted);
      font-size: 11px;
    }

    .footer-actions { display: flex; gap: 12px; }

    :host([data-era-compact="true"]) { width: 260px; }
    :host([data-era-compact="true"]) .intro,
    :host([data-era-compact="true"]) .turn-line,
    :host([data-era-compact="true"]) .footer { display: none; }
    :host([data-era-compact="true"]) .body { padding-top: 14px; }
    :host([data-era-compact="true"]) .stage { min-height: 112px; }
    :host([data-era-compact="true"]) .title { font-size: 23px; }
    :host([data-era-compact="true"]) .timer { width: 96px; height: 96px; }
    :host([data-era-compact="true"]) .timer::before { width: 76px; height: 76px; }
    :host([data-era-compact="true"]) .timer-value { font-size: 29px; }

    @media (max-width: 900px) {
      :host {
        top: 12px;
        right: 12px;
        left: auto;
        width: min(286px, calc(100vw - 24px));
        transform: none;
      }
    }

    @media (max-height: 600px) {
      :host { width: min(240px, calc(100vw - 24px)); }
      .header { padding: 10px 12px 8px; }
      .brand span,
      .intro,
      .turn-line,
      .footer { display: none; }
      .body { padding: 10px 12px 12px; }
      .stage { min-height: 88px; }
      .title { font-size: 22px; }
      .red-word { margin-top: 6px; font-size: 15px; }
      .timer { width: 86px; height: 86px; margin-bottom: 3px; }
      .timer::before { width: 68px; height: 68px; }
      .timer-value { font-size: 27px; }
      .note { margin-top: 5px; }
      .primary { min-height: 44px; margin-top: 8px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .primary { transition: none; }
    }
  `;
})();

