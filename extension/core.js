(() => {
  'use strict';

  const TURN_HEADING = /(?:^|\n)\s*(轮次\s*\d+)\s*[:：]?\s*/g;
  const PAUSE_SUFFIX = /\s*[—–─-]{2,}\s*(\d+(?:\.\d+)?)\s*s\s*$/i;

  function normalizeInline(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function fingerprint(value) {
    let hash = 0x811c9dc5;
    const input = JSON.stringify(value);
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function parseTurns(source, redFragments = []) {
    const normalized = String(source ?? '').replace(/\r\n?/g, '\n').trim();
    const headings = [...normalized.matchAll(TURN_HEADING)];
    const issues = [];
    const reds = redFragments.map(normalizeInline).filter(Boolean);

    if (headings.length === 0) {
      const result = {
        turns: [],
        issues: [{
          code: 'no-turns',
          turnIndex: null,
          message: '未识别到剧本轮次。',
        }],
      };
      return { ...result, fingerprint: fingerprint(result) };
    }

    const turns = headings.map((heading, turnIndex) => {
      const bodyStart = heading.index + heading[0].length;
      const bodyEnd = headings[turnIndex + 1]?.index ?? normalized.length;
      let body = normalized.slice(bodyStart, bodyEnd).trim();
      const pauseMatch = body.match(PAUSE_SUFFIX);
      let pauseSeconds = null;

      if (pauseMatch) {
        pauseSeconds = Number(pauseMatch[1]);
        body = body.slice(0, pauseMatch.index);
      } else {
        issues.push({
          code: 'missing-pause',
          turnIndex,
          message: `${heading[1].replace(/\s/g, '')} 缺少句末静音时长。`,
        });
      }

      const text = normalizeInline(body);
      const redText = reds.find((fragment) => text.includes(fragment)) ?? null;
      return {
        label: heading[1].replace(/\s/g, ''),
        text,
        pauseSeconds,
        hasRed: redText !== null,
        redText,
      };
    });

    const payload = { turns, issues };
    return { ...payload, fingerprint: fingerprint(payload) };
  }

  function freezeState(state) {
    return Object.freeze(state);
  }

  function createSession(turns) {
    const stableTurns = Object.freeze(
      [...(turns ?? [])].map((turn) => Object.freeze({ ...turn })),
    );
    return freezeState({
      turns: stableTurns,
      phase: stableTurns.length > 0 ? 'reading' : 'complete',
      turnIndex: stableTurns.length > 0 ? 0 : -1,
      phaseStartedAt: null,
      deadline: null,
    });
  }

  function assertTimestamp(now) {
    if (!Number.isFinite(now)) {
      throw new TypeError('Timer timestamps must be finite numbers.');
    }
  }

  function activatePrimary(state, now) {
    assertTimestamp(now);
    if (state.phase !== 'reading') {
      return state;
    }

    const turn = state.turns[state.turnIndex];
    if (!turn || !Number.isFinite(turn.pauseSeconds)) {
      return state;
    }

    if (turn.hasRed) {
      return freezeState({
        ...state,
        phase: 'post-red',
        phaseStartedAt: now,
        deadline: now + 5_000,
      });
    }

    return freezeState({
      ...state,
      phase: 'pause',
      phaseStartedAt: now,
      deadline: now + (turn.pauseSeconds * 1_000),
    });
  }

  function advanceSession(state, now) {
    assertTimestamp(now);
    if (state.deadline === null || now < state.deadline) {
      return state;
    }

    if (state.phase === 'post-red') {
      const turn = state.turns[state.turnIndex];
      const pause = freezeState({
        ...state,
        phase: 'pause',
        phaseStartedAt: state.deadline,
        deadline: state.deadline + (turn.pauseSeconds * 1_000),
      });
      return advanceSession(pause, now);
    }

    if (state.phase === 'pause') {
      const nextTurnIndex = state.turnIndex + 1;
      if (nextTurnIndex >= state.turns.length) {
        return freezeState({
          ...state,
          phase: 'complete',
          phaseStartedAt: state.deadline,
          deadline: null,
        });
      }
      return freezeState({
        ...state,
        phase: 'reading',
        turnIndex: nextTurnIndex,
        phaseStartedAt: state.deadline,
        deadline: null,
      });
    }

    return state;
  }

  function remainingMs(state, now) {
    assertTimestamp(now);
    return state.deadline === null ? 0 : Math.max(0, state.deadline - now);
  }

  globalThis.RecordingAssistantCore = Object.freeze({
    parseTurns,
    createSession,
    activatePrimary,
    advanceSession,
    remainingMs,
  });
})();

