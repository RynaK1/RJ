(async () => {
  const results = [];
  const check = (value, message) => { if (!value) throw Error(message); results.push(message); };
  const NativeDate = Date;
  let clock = '2026-10-02T08:00:00Z';
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return new NativeDate(clock).getTime(); }
  };
  const clone = value => structuredClone(value);
  const task = (id, options = {}) => ({ id, text: id, done: false, ...options });
  queueSupabaseSync = () => {};
  queueSharedRjSync = () => {};
  renderAll = () => {};
  renderSaveStatus = () => {};
  refreshPairingContext = async () => {};
  activeStorageKey = getUserStorageKey('reset-simulation');
  pairingContext.accepted = { id: 'reset-pair' };
  sharedRjPairingId = 'reset-pair';
  const setup = (zone = '-08:00', dst = 0) => {
    state = clone(defaultState); selfState = state;
    state.settings.timezoneOffset = zone;
    state.settings.daylightSavingsAdjustment = dst;
    state.activeListSet = 'rj';
    for (const [id, set] of Object.entries(state.listSets)) {
      const today = id === 'schedms' ? formatDateParts(new Date()) : dailyPeriodId(new Date());
      set.periodIds = { daily: today, weekly: today, persistent: today };
    }
    sharedRjState = { periodId: dailyPeriodId(new Date()), lastSavedAt: clock, deletedTaskIds: [], tasks: { todo: [], schedule: [] } };
  };

  // This reproduces completed tasks arriving after today's reset marker was saved.
  setup();
  state.listSets.rj.tasks.persistent.push(task('late-finished', { done: true, completedOn: '2026-10-01' }));
  sharedRjState.tasks.todo.push(task('late-shared-finished', { done: true, completedOn: '2026-10-01' }));
  runTimedUpdatesIfNeeded();
  check(!state.listSets.rj.tasks.persistent.some(t => t.id === 'late-finished'), 'A current reset marker cannot block removal of an expired IRL completion');
  check(!sharedRjState.tasks.todo.length, 'A current shared reset marker cannot block completed-task cleanup');
  check(schedmsDailyPeriodId(new Date('2026-10-02T00:00:00Z')) === '2026-10-02', 'MS day always uses UTC regardless of the selected zone');

  setup();
  const oldFinished = clone(state);
  oldFinished.listSets.rj.tasks.persistent.push(task('undone', { done: true, completedOn: '2026-10-01' }));
  state.listSets.rj.tasks.persistent.push(task('undone'));
  state.lastSavedAt = clock; oldFinished.lastSavedAt = '2026-10-01T12:00:00Z';
  state = reconcilePlannerStates(oldFinished, state); selfState = state;
  check(state.listSets.rj.tasks.persistent.some(t => t.id === 'undone' && !t.done), 'An intentional undo survives an older completed cloud copy');

  let callback;
  let delay;
  window.setTimeout = (fn, ms) => { callback = fn; delay = ms; return 1; };
  window.clearTimeout = () => {};
  let boundaries = 0;
  for (const [zone] of TIMEZONE_OPTIONS) for (const dst of [0, 1]) for (let day = 0; day < 30; day += 1) {
    for (const mode of ['rj', 'schedms']) {
      clock = new NativeDate(NativeDate.UTC(2026, 9, 1 + day, 12)).toISOString();
      setup(zone, dst);
      const resetAt = mode === 'rj' ? nextPlannerDailyResetDate() : nextUtcDailyResetDate();
      clock = new NativeDate(resetAt.getTime() - 1000).toISOString();
      setup(zone, dst);
      const collections = mode === 'rj' ? [state.listSets.rj.tasks.persistent, ...Object.values(sharedRjState.tasks)] : Object.values(state.listSets.schedms.tasks);
      state.activeListSet = mode;
      collections.forEach((tasks, index) => {
        tasks.push(task('open-' + index), task('done-' + index), task('repeat-' + index, { recurring: true, intervalDays: 1 }));
        setTaskCompletionState(tasks[1], true);
        setTaskCompletionState(tasks[2], true);
      });
      const staleBeforeCompletion = clone(state);
      const staleShared = clone(sharedRjState);
      staleBeforeCompletion.listSets[mode].tasks[mode === 'rj' ? 'persistent' : 'daily'][1].done = false;
      staleShared.tasks.todo.forEach(t => { t.done = false; });
      clock = new NativeDate(resetAt.getTime() - 1).toISOString();
      tickResets();
      const currentCollections = () => mode === 'rj' ? [state.listSets.rj.tasks.persistent, ...Object.values(sharedRjState.tasks)] : Object.values(state.listSets.schedms.tasks);
      if (currentCollections().some(tasks => !tasks.find(t => t.id.startsWith('done-'))?.done)) throw Error(`Early cleanup: ${mode} ${zone} DST ${dst}`);
      if (delay !== 1) throw Error(`Timer missed next midnight: ${mode} ${zone} DST ${dst}: ${delay}`);
      clock = resetAt.toISOString();
      callback();
      const assertCleared = () => currentCollections().forEach(tasks => {
        if (tasks.some(t => t.id.startsWith('done-'))) throw Error(`Completion survived midnight: ${mode} ${zone} DST ${dst}`);
        if (!tasks.some(t => t.id.startsWith('open-') && !t.done)) throw Error('Unfinished task was lost');
        if (!tasks.some(t => t.id.startsWith('repeat-') && !t.done)) throw Error('Recurring occurrence was not reset');
      });
      assertCleared();
      state = loadStateFromStorage(activeStorageKey); selfState = state;
      if (mode === 'rj') sharedRjState = loadSharedRjStateFromStorage('reset-pair');
      assertCleared();
      // A later stale snapshot, even with a misleading newer save timestamp,
      // must not resurrect a completed one-time task as unfinished.
      staleBeforeCompletion.lastSavedAt = new NativeDate(resetAt.getTime() + 1000).toISOString();
      state = reconcilePlannerStates(staleBeforeCompletion, state); selfState = state;
      if (mode === 'rj') sharedRjState = reconcileSharedStates(staleShared, sharedRjState);
      runTimedUpdatesIfNeeded();
      assertCleared();
      boundaries += 1;
    }
  }
  check(true, `${boundaries} midnight simulations across ${TIMEZONE_OPTIONS.length} zones, both DST settings, IRL and MS: completed tasks clear, recurring tasks reset, unfinished tasks persist, reloads and stale sync stay cleared`);

  clock = '2026-10-02T00:00:00Z'; setup('-08:00');
  state.listSets.schedms.tasks.daily.push(task('ms', { done: true, completedOn: '2026-10-01' }));
  state.listSets.rj.tasks.persistent.push(task('irl', { done: true, completedOn: '2026-10-01' }));
  runTimedUpdatesIfNeeded();
  check(!state.listSets.schedms.tasks.daily.length && state.listSets.rj.tasks.persistent.length === 1, 'At midnight UTC, MS clears while PST IRL stays until 08:00 UTC');
  clock = '2026-10-02T08:00:00Z'; runTimedUpdatesIfNeeded();
  check(!state.listSets.rj.tasks.persistent.length, 'PST IRL clears at its own midnight');
  state.activeListSet = 'schedms'; renderResetLabels();
  check(els.dailyResetLabel.textContent.endsWith('UTC') && els.dailyResetLabel.textContent.includes('12:00'), 'MS reset label explicitly shows midnight UTC');

  // Exercise the real mocked cloud write path with already-current markers.
  setup();
  state.listSets.rj.tasks.persistent.push(task('repeat-live', { done: true, recurring: true, intervalDays: 1, completedOn: '2026-10-01' }));
  const visibleRecurring = state.listSets.rj.tasks.persistent[0];
  const lateCloud = clone(state);
  lateCloud.listSets.rj.tasks.persistent.push(task('cloud-finished', { done: true, completedOn: '2026-10-01' }));
  let written;
  supabaseUserId = 'reset-simulation'; supabaseSyncPending = true;
  supabaseClient = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: lateCloud } }) }) }),
    upsert: async payload => { written = payload.data; return {}; },
  }) };
  await flushSupabaseSync();
  check(!written.listSets.rj.tasks.persistent.some(t => t.id === 'cloud-finished'), 'Late cloud completion is cleaned before an actual save, despite a current marker');
  check(visibleRecurring === state.listSets.rj.tasks.persistent[0] && !visibleRecurring.done && !visibleRecurring.completedOn, 'Background save resets the live recurring card and clears its completion metadata');
  clock = '2026-10-10T12:00:00Z'; setup();
  state.listSets.rj.tasks.persistent.push(task('sleep', { done: true, completedOn: '2026-10-02' }));
  state.listSets.rj.periodIds.persistent = '2099-01-01';
  tickResets();
  check(!state.listSets.rj.tasks.persistent.length, 'Resuming after sleep cleans expired completions even with a future reset marker');
  document.body.textContent = 'PASS\n' + results.join('\n');
})().catch(error => { document.body.textContent = 'FAIL\n' + error.stack; });
