import test from 'node:test';
import assert from 'node:assert/strict';

await import('../extension/core.js');

const {
  parseTurns,
  createSession,
  activatePrimary,
  advanceSession,
  remainingMs,
} = globalThis.RecordingAssistantCore ?? {};

test('parseTurns extracts pauses and assigns the visible red fragment to its turn', () => {
  const source = [
    '轮次1:I often watch the clouds at six with my friend.——6s',
    '轮次2:请纠正上一句话。——9s',
    '轮次3:I am agree that six is a good time to watch the clouds. The clouds are pink near the sun.——7s',
  ].join('\n');

  const result = parseTurns(source, ['I am agree']);

  assert.deepEqual(result.issues, []);
  assert.equal(result.turns.length, 3);
  assert.deepEqual(result.turns[0], {
    label: '轮次1',
    text: 'I often watch the clouds at six with my friend.',
    pauseSeconds: 6,
    hasRed: false,
    redText: null,
  });
  assert.equal(result.turns[2].pauseSeconds, 7);
  assert.equal(result.turns[2].hasRed, true);
  assert.equal(result.turns[2].redText, 'I am agree');
});

test('parseTurns reports a missing pause instead of inventing a default', () => {
  const result = parseTurns([
    '轮次1:This turn has no pause marker.',
    '轮次2:This turn is valid.——3s',
  ].join('\n'), []);

  assert.equal(result.turns[0].pauseSeconds, null);
  assert.deepEqual(result.issues, [{
    code: 'missing-pause',
    turnIndex: 0,
    message: '轮次1 缺少句末静音时长。',
  }]);
});

test('parseTurns fingerprint is stable for the same task and changes with task content', () => {
  const first = parseTurns('轮次1:Hello there.——3s', []);
  const same = parseTurns('  轮次1:Hello there.——3s  ', []);
  const changed = parseTurns('轮次1:Hello again.——3s', []);

  assert.equal(first.fingerprint, same.fingerprint);
  assert.notEqual(first.fingerprint, changed.fingerprint);
  assert.match(first.fingerprint, /^[a-f0-9]{8}$/);
});

test('ordinary turn primary action starts its exact annotated pause', () => {
  const turns = [
    { label: '轮次1', text: 'Hello.', pauseSeconds: 6, hasRed: false, redText: null },
    { label: '轮次2', text: 'Again.', pauseSeconds: 3, hasRed: true, redText: 'Again' },
  ];
  const initial = createSession(turns);

  const paused = activatePrimary(initial, 1_000);

  assert.equal(paused.phase, 'pause');
  assert.equal(paused.turnIndex, 0);
  assert.equal(paused.deadline, 7_000);
  assert.equal(remainingMs(paused, 2_500), 4_500);
  assert.strictEqual(advanceSession(paused, 6_999), paused);
  const next = advanceSession(paused, 7_000);
  assert.equal(next.phase, 'reading');
  assert.equal(next.turnIndex, 1);
});

test('red turn primary action always starts an unshortenable five-second window', () => {
  const turns = [
    { label: '轮次1', text: 'I am agree with the idea.', pauseSeconds: 7, hasRed: true, redText: 'am agree' },
  ];
  const initial = createSession(turns);
  const postRed = activatePrimary(initial, 2_000);

  assert.equal(postRed.phase, 'post-red');
  assert.equal(postRed.deadline, 7_000);
  assert.strictEqual(activatePrimary(postRed, 3_000), postRed);
  assert.strictEqual(advanceSession(postRed, 6_999), postRed);

  const pause = advanceSession(postRed, 7_000);
  assert.equal(pause.phase, 'pause');
  assert.equal(pause.deadline, 14_000);
  assert.strictEqual(activatePrimary(pause, 8_000), pause);
});

test('late ticks carry absolute deadlines instead of lengthening either timer', () => {
  const turns = [
    { label: '轮次1', text: 'Red phrase and enough words.', pauseSeconds: 3, hasRed: true, redText: 'Red phrase' },
    { label: '轮次2', text: 'Next.', pauseSeconds: 2, hasRed: false, redText: null },
  ];
  const postRed = activatePrimary(createSession(turns), 1_000);

  const caughtUp = advanceSession(postRed, 10_500);

  assert.equal(caughtUp.phase, 'reading');
  assert.equal(caughtUp.turnIndex, 1);
  assert.equal(caughtUp.deadline, null);
});

test('the final annotated pause ends the session', () => {
  const turns = [
    { label: '轮次1', text: 'Done.', pauseSeconds: 2, hasRed: false, redText: null },
  ];
  const paused = activatePrimary(createSession(turns), 5_000);

  const complete = advanceSession(paused, 7_000);

  assert.equal(complete.phase, 'complete');
  assert.equal(complete.turnIndex, 0);
  assert.equal(complete.deadline, null);
});

