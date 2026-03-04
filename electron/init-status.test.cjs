const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitStatusTracker } = require('./init-status.cjs');

test('createInitStatusTracker clamps progress and preserves latest message', () => {
  const tracker = createInitStatusTracker();

  tracker.update({ phase: 'boot', message: 'starting', progress: -10 });
  let state = tracker.getState();
  assert.equal(state.progress, 0);
  assert.equal(state.message, 'starting');

  tracker.update({ phase: 'db', message: 'database ready', progress: 150 });
  state = tracker.getState();
  assert.equal(state.progress, 100);
  assert.equal(state.phase, 'db');
  assert.equal(state.message, 'database ready');
});

test('createInitStatusTracker marks ready and clears error on complete', () => {
  const tracker = createInitStatusTracker();
  tracker.fail(new Error('boom'));

  tracker.complete('done');
  const state = tracker.getState();
  assert.equal(state.ready, true);
  assert.equal(state.error, null);
  assert.equal(state.message, 'done');
  assert.equal(state.progress, 100);
});
