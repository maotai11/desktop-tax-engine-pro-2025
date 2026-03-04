function clampProgress(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createInitStatusTracker(initialState = {}) {
  const state = {
    ready: false,
    phase: 'boot',
    message: 'starting',
    progress: 0,
    error: null,
    ...initialState,
  };

  const getState = () => ({ ...state });

  const update = (patch = {}) => {
    if (typeof patch.phase === 'string') state.phase = patch.phase;
    if (typeof patch.message === 'string') state.message = patch.message;
    if (patch.progress !== undefined) state.progress = clampProgress(Number(patch.progress));
    if (patch.error !== undefined) state.error = patch.error ? String(patch.error) : null;
    if (patch.ready !== undefined) state.ready = Boolean(patch.ready);
    return getState();
  };

  const complete = (message = 'ready') => update({ ready: true, phase: 'ready', message, progress: 100, error: null });
  const fail = (error) => update({ ready: false, phase: 'error', error: String(error?.message || error || 'unknown error') });

  return { getState, update, complete, fail };
}

module.exports = { createInitStatusTracker };
