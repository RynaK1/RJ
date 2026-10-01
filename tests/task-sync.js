(async () => {
  const results = [];
  const check = (condition, message) => { if (!condition) throw Error(message); results.push(message); };
  const NativeDate = Date;
  let clock = '2026-10-01T12:00:00Z';
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return new NativeDate(clock).getTime(); }
  };
  const clone = value => structuredClone(value);
  const task = id => ({ id, text: id, done: false });
  const personal = ids => {
    const value = clone(defaultState);
    value.settings.timezoneOffset = '-08:00';
    value.lastSavedAt = clock;
    value.listSets.rj.tasks.persistent = ids.map(task);
    return value;
  };
  const shared = ids => ({ lastSavedAt: clock, periodId: dailyPeriodId(new Date()), deletedTaskIds: [], tasks: { todo: ids.map(task), schedule: [] } });
  renderSaveStatus = () => {};
  refreshPairingContext = async () => {};
  hydrateStateUIAfterRemoteLoad = () => {};
  showPlannerView = () => {};
  upsertPlannerProfile = async () => {};
  // Exercise real local persistence, while invoking mock cloud saves explicitly.
  queueSupabaseSync = () => { personalChangesUnsaved = true; };
  queueSharedRjSync = () => { sharedChangesUnsaved = true; };
  activeStorageKey = getUserStorageKey('simulation-user');
  supabaseUserId = 'simulation-user';
  state = personal(['local-only']); selfState = state;
  persistLocalState();
  const newerRemote = personal(['remote-only']);
  newerRemote.lastSavedAt = '2026-10-01T13:00:00Z';
  check(!newerRemote.listSets.rj.tasks.persistent.some(t => t.id === 'local-only'), 'Reproduced: choosing the newer whole snapshot loses an unfinished local task');
  supabaseClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: clone(newerRemote) } }) }) }) }) };
  await loadAuthenticatedPlanner({ id: 'simulation-user', email: 'simulation@example.invalid' });
  check(state.listSets.rj.tasks.persistent.map(t => t.id).sort().join(',') === 'local-only,remote-only', 'Authenticated reload reconciles newer cloud data with unfinished local tasks');
  check(personalChangesUnsaved, 'Recovered local tasks are queued for upload');

  let resolveRead;
  supabaseClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(resolve => { resolveRead = resolve; }) }) }) }) };
  const loading = loadAuthenticatedPlanner({ id: 'simulation-user', email: 'simulation@example.invalid' });
  await Promise.resolve();
  state.listSets.rj.tasks.persistent.push(task('added-during-login'));
  saveState();
  resolveRead({ data: { data: clone(newerRemote) } });
  await loading;
  check(state.listSets.rj.tasks.persistent.some(t => t.id === 'added-during-login'), 'An edit during a delayed login read survives the response');

  const staleCopy = clone(state);
  removeTaskFromList('persistent', 'local-only');
  saveState();
  const deletionReload = reconcilePlannerStates(staleCopy, loadStateFromStorage(activeStorageKey));
  check(!deletionReload.listSets.rj.tasks.persistent.some(t => t.id === 'local-only'), 'Manual personal deletion survives stale snapshots and actual storage reload');
  const moved = personal(['moved']);
  const beforeMove = clone(moved);
  moved.listSets.rj.tasks.persistent = [];
  moved.listSets.schedms.tasks.weekly.push(task('moved'));
  moved.lastSavedAt = '2026-10-01T14:00:00Z';
  const moveResult = reconcilePlannerStates(beforeMove, moved);
  check(moveResult.listSets.schedms.tasks.weekly.length === 1 && moveResult.listSets.rj.tasks.persistent.length === 0, 'Reconciliation preserves a moved task without duplicating its old list');
  const completed = personal(['expired']);
  completed.listSets.rj.tasks.persistent[0] = { ...task('expired'), done: true, completedOn: '2026-09-30' };
  const afterCleanup = personal([]); afterCleanup.lastSavedAt = '2026-10-01T15:00:00Z';
  check(reconcilePlannerStates(afterCleanup, completed).listSets.rj.tasks.persistent.length === 0, 'Reconciliation does not resurrect expired completed tasks');

  // Reproduce an interrupted write, then retry against a newer cloud snapshot.
  state = personal(['unsaved']); selfState = state;
  const visibleArray = state.listSets.rj.tasks.persistent;
  const visibleTask = visibleArray[0];
  saveState();
  supabaseSyncReady = true; supabaseSyncPending = true; supabaseSyncInFlight = false;
  let writes = 0;
  let writePayload;
  const cloud = personal(['other-device']);
  supabaseClient = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: clone(cloud) } }) }) }),
    upsert: async payload => { writes += 1; writePayload = payload; return writes === 1 ? { error: { message: 'Simulated offline write' } } : {}; },
  }) };
  await flushSupabaseSync();
  check(state.listSets.rj.tasks.persistent === visibleArray && visibleArray[0] === visibleTask, 'Background sync preserves the references held by visible task controls');
  check(supabaseSyncPending && personalChangesUnsaved && writes === 1, 'Failed personal write stays queued without an immediate retry loop');
  check(loadStateFromStorage(activeStorageKey).listSets.rj.tasks.persistent.some(t => t.id === 'unsaved'), 'Failed write leaves the unfinished task in local storage');
  await flushSupabaseSync();
  check(!supabaseSyncPending && !personalChangesUnsaved && writes === 2, 'Retry successfully saves the queued personal task');
  check(writePayload.data.listSets.rj.tasks.persistent.map(t => t.id).sort().join(',') === 'other-device,unsaved', 'A save preserves tasks already created on another device');

  // New edits made while a cloud write is pending must get a second write.
  let resolveWrite;
  writes = 0;
  supabaseClient = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: personal([]) } }) }) }),
    upsert: payload => { writePayload = payload; writes += 1; return writes === 1 ? new Promise(resolve => { resolveWrite = resolve; }) : Promise.resolve({}); },
  }) };
  supabaseSyncPending = true;
  const saving = flushSupabaseSync();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  state.listSets.rj.tasks.persistent.push(task('during-write')); saveState(); supabaseSyncPending = true;
  resolveWrite({});
  await saving;
  check(writes === 2 && writePayload.data.listSets.rj.tasks.persistent.some(t => t.id === 'during-write'), 'Edits during an in-flight save are included in a subsequent save');

  // A failed read must never lead to uploading an incomplete replacement.
  writes = 0; supabaseSyncPending = true;
  supabaseClient = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'Simulated read outage' } }) }) }),
    upsert: async () => { writes += 1; return {}; },
  }) };
  await flushSupabaseSync();
  check(writes === 0 && supabaseSyncPending && state.listSets.rj.tasks.persistent.some(t => t.id === 'during-write'), 'Cloud read outage cannot overwrite cloud data or clear unfinished local tasks');

  // Responses from a previous account/session must be ignored.
  supabaseClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(resolve => { resolveRead = resolve; }) }) }) }) };
  const oldLogin = loadAuthenticatedPlanner({ id: 'simulation-user', email: 'simulation@example.invalid' });
  await Promise.resolve();
  plannerSessionVersion += 1; supabaseUserId = 'other-user';
  state = personal(['new-session-task']); selfState = state;
  resolveRead({ data: { data: clone(newerRemote) } });
  await oldLogin;
  check(state.listSets.rj.tasks.persistent[0].id === 'new-session-task', 'A late login response cannot replace tasks in the next session');
  supabaseUserId = 'simulation-user'; supabaseSyncPending = false;

  pairingContext.accepted = { id: 'simulation-pair' }; sharedRjPairingId = 'simulation-pair';
  sharedRjState = shared(['mine-shared']); persistSharedRjState();
  const remoteShared = shared(['partner-shared']); remoteShared.lastSavedAt = '2026-10-01T15:00:00Z';
  sharedChangesUnsaved = false; sharedRjSyncPending = false; sharedRjSyncInFlight = false;
  supabaseClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: clone(remoteShared) } }) }) }) }) };
  await loadSharedRjPlannerState();
  check(sharedRjState.tasks.todo.map(t => t.id).sort().join(',') === 'mine-shared,partner-shared', 'A newer partner snapshot cannot discard unfinished shared tasks');
  renderInteractiveRjList(sharedRjState.tasks.todo, els.sharedRjTodoList, els.sharedRjTodoEmpty, 'shared', 'todo');
  els.sharedRjTodoList.querySelector('[data-task-id="mine-shared"] .delete-btn').click();
  const sharedDeletion = reconcileSharedStates(shared(['mine-shared']), loadSharedRjStateFromStorage('simulation-pair'));
  check(!sharedDeletion.tasks.todo.some(t => t.id === 'mine-shared'), 'Actual shared delete button records a deletion that survives stale data');

  sharedRjState = shared(['offline-shared']); saveSharedRjState();
  sharedRjSyncPending = true; sharedRjSyncInFlight = false; sharedRjRemoteAvailable = true;
  writes = 0;
  supabaseClient = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: clone(remoteShared) } }) }) }),
    upsert: async payload => { writePayload = payload; writes += 1; return writes === 1 ? { error: { message: 'Simulated shared write failure' } } : {}; },
  }) };
  await flushSharedRjSync();
  check(sharedRjSyncPending && loadSharedRjStateFromStorage('simulation-pair').tasks.todo.some(t => t.id === 'offline-shared'), 'Interrupted shared save retains unfinished local tasks and queues a retry');
  await flushSharedRjSync();
  check(writes === 2 && writePayload.data.tasks.todo.map(t => t.id).sort().join(',') === 'offline-shared,partner-shared', 'Shared retry preserves both users tasks');

  // Stress resets and real storage reloads across every supported zone and DST setting.
  supabaseSyncReady = false; supabaseSyncPending = false; sharedRjSyncPending = false;
  let simulatedDays = 0;
  let collectionChecks = 0;
  for (const [zone] of TIMEZONE_OPTIONS) for (const dst of [0, 1]) {
    state = personal([]); state.settings.timezoneOffset = zone; state.settings.daylightSavingsAdjustment = dst; selfState = state;
    pairingContext.accepted = { id: 'simulation-pair' }; sharedRjPairingId = 'simulation-pair';
    sharedRjState = shared([]);
    const collections = () => [...LIST_SET_IDS.flatMap(id => LIST_TYPES.map(kind => state.listSets[id].tasks[kind])), ...Object.values(sharedRjState.tasks)];
    const ids = collections().map((tasks, index) => { const id = 'keep-' + index; tasks.push(task(id)); return id; });
    for (let day = 0; day < 90; day += 1) {
      clock = new NativeDate(NativeDate.UTC(2026, 9, 1 + day, day % 24, 59, 59)).toISOString();
      runTimedUpdatesIfNeeded();
      // A second stale/newer cloud snapshot lacks one-time tasks entirely.
      const stale = personal([]); stale.settings = clone(state.settings); stale.lastSavedAt = new Date(Date.now() + 1000).toISOString();
      state = reconcilePlannerStates(stale, state); selfState = state;
      sharedRjState = reconcileSharedStates(shared([]), sharedRjState);
      saveState(); saveSharedRjState();
      state = loadStateFromStorage(activeStorageKey); selfState = state;
      sharedRjState = loadSharedRjStateFromStorage('simulation-pair');
      collections().forEach((tasks, index) => {
        if (!tasks.some(t => t.id === ids[index] && !t.done)) throw Error(`Unfinished task lost: ${zone}, DST ${dst}, day ${day}, list ${index}`);
        collectionChecks += 1;
      });
      simulatedDays += 1;
    }
  }
  check(true, `${simulatedDays} simulated days across all ${TIMEZONE_OPTIONS.length} zones and both DST settings: ${collectionChecks} successful collection retention checks with real storage reloads`);
  window.clearTimeout(dailyResetTimeout);
  document.body.textContent = 'PASS\n' + results.join('\n');
})().catch(error => { document.body.textContent = 'FAIL\n' + error.stack; });
