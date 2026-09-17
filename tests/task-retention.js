(async () => {
  const results = [];
  const check = (value, message) => { if (!value) throw new Error(message); results.push(message); };
  const NativeDate = Date;
  let clock = '2026-09-17T12:00:00Z';
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return new NativeDate(clock).getTime(); }
  };
  const actualSharedSave = saveSharedRjState;
  saveState = () => {};
  saveSharedRjState = () => {};
  state = structuredClone(defaultState);
  state.settings.timezoneOffset = '+00:00';
  state.activeListSet = 'rj';
  selfState = state;
  pairingContext.accepted = { id: 'retention-test' };
  sharedRjPairingId = 'retention-test';
  const fixtures = () => [
    { id: 'open', text: 'Unfinished', done: false },
    { id: 'past', text: 'Overdue', done: false, irlKind: 'schedule', showOnDate: '2026-09-01' },
    { id: 'future', text: 'Future', done: false, irlKind: 'schedule', showOnDate: '2026-12-01' },
    { id: 'weekly', text: 'Unfinished Wednesday', done: false, recurring: true, intervalDays: 7, showDays: [3], recurringStartDate: '2026-09-16', nextDueDate: '2026-09-23' },
    { id: 'legacy', text: 'Missing timing metadata', done: false, recurring: true, intervalDays: 7, showDays: [3] },
    { id: 'done', text: 'Finished yesterday', done: true, completedOn: '2026-09-16' },
  ];
  for (const set of Object.values(state.listSets)) {
    set.periodIds = { daily: '2026-09-16', weekly: 'old', persistent: '2026-09-16' };
    for (const key of Object.keys(set.tasks)) set.tasks[key] = fixtures();
  }
  sharedRjState = { periodId: '2026-09-16', lastSavedAt: '', tasks: { todo: fixtures(), schedule: fixtures() } };
  for (let day = 0; day < 40; day++) {
    clock = new NativeDate(NativeDate.UTC(2026, 8, 17 + day, 12)).toISOString();
    runTimedUpdatesIfNeeded();
    for (const set of Object.values(state.listSets)) for (const tasks of Object.values(set.tasks)) {
      if (tasks.map(t => t.id).join(',') !== 'open,past,future,weekly,legacy') throw Error('Personal retention failed on day ' + day);
    }
    for (const tasks of Object.values(sharedRjState.tasks)) if (tasks.length !== 5) throw Error('Shared retention failed');
    for (const id of ['weekly', 'legacy']) if (!isTaskVisibleInList('persistent', state.listSets.rj.tasks.persistent.find(t => t.id === id))) throw Error('Unfinished recurring item hidden: ' + id);
    state = normalizeStateData(JSON.parse(JSON.stringify(state))); selfState = state;
    sharedRjState = normalizeSharedRjState(JSON.parse(JSON.stringify(sharedRjState)));
  }
  check(true, '40 days and reloads retain every unfinished item in all personal/shared lists');
  const today = dailyPeriodId(new Date());
  const open = state.listSets.rj.tasks.persistent.find(t => t.id === 'open');
  setTaskCompletionState(open, true);
  check(open.completedOn === today, 'Manual completion records the correct day');
  state.listSets.rj.periodIds.persistent = '2026-09-01';
  runTimedUpdatesIfNeeded();
  check(state.listSets.rj.tasks.persistent.includes(open), 'Late reset preserves items completed today');
  const before = JSON.stringify(state.listSets.rj);
  resetRjDay(state.listSets.rj, '2026-09-01');
  check(JSON.stringify(state.listSets.rj) === before, 'Backward clock cannot reset tasks');
  clock = new NativeDate(new NativeDate(clock).getTime() + 86400000).toISOString();
  runTimedUpdatesIfNeeded();
  check(!state.listSets.rj.tasks.persistent.some(t => t.id === 'open'), 'Completed item clears on the following day');
  check(normalizeTaskSet([{ id: 'false', text: 'Legacy boolean', done: 'false' }])[0].done === false, 'Non-boolean flags cannot mark a task finished');

  for (const owner of ['mine', 'shared']) {
    const tasks = [
      { id: 'hidden', text: 'Future', irlKind: 'schedule', showOnDate: '2099-01-01', done: false },
      { id: 'a', text: 'A', irlKind: 'schedule', done: false },
      { id: 'b', text: 'B', irlKind: 'schedule', done: false },
    ];
    if (owner === 'mine') state.listSets.rj.tasks.persistent = tasks;
    else sharedRjState.tasks.schedule = tasks;
    const collection = () => owner === 'mine' ? state.listSets.rj.tasks.persistent : sharedRjState.tasks.schedule;
    reorderRjListTasks(owner, 'schedule', ['b', 'a']);
    check(collection().map(t => t.id).join(',') === 'hidden,b,a', owner + ': reorder preserves hidden scheduled tasks');
    reorderRjListTasks(owner, 'schedule', ['a']);
    check(collection().map(t => t.id).join(',') === 'hidden,b,a', owner + ': incomplete drag cannot overwrite another task');
  }

  state.listSets.rj.tasks.persistent = [
    { id: 'todo-a', text: 'A', done: false, irlKind: 'todo' },
    { id: 'repeat', text: 'Recurring', done: false, irlKind: 'todo', recurring: true },
    { id: 'todo-b', text: 'B', done: false, irlKind: 'todo' },
  ];
  rjDragState.taskGroup = 'one-time-open';
  reorderRjListTasks('mine', 'todo', ['repeat', 'todo-b', 'todo-a']);
  check(state.listSets.rj.tasks.persistent.map(t => t.id).join(',') === 'todo-b,repeat,todo-a', 'To-do drag preserves other recurrence groups');

  const currentDay = dailyPeriodId(new Date());
  for (const [id, set] of Object.entries(state.listSets)) {
    state.activeListSet = id;
    for (const tasks of Object.values(set.tasks)) {
      tasks.push({ id: 'finish-next', text: 'Finish', done: false });
      setTaskCompletionState(tasks.at(-1), true);
    }
  }
  state.activeListSet = 'rj';
  for (const tasks of Object.values(sharedRjState.tasks)) {
    tasks.push({ id: 'finish-next', text: 'Finish shared', done: false });
    setTaskCompletionState(tasks.at(-1), true);
  }
  runTimedUpdatesIfNeeded();
  for (const set of Object.values(state.listSets)) for (const tasks of Object.values(set.tasks)) check(tasks.some(t => t.id === 'finish-next'), 'Same-day completion retained');
  clock = new NativeDate(new NativeDate(clock).getTime() + 86400000).toISOString();
  runTimedUpdatesIfNeeded();
  for (const set of Object.values(state.listSets)) for (const tasks of Object.values(set.tasks)) check(!tasks.some(t => t.id === 'finish-next'), 'Next-day completion removed');
  for (const tasks of Object.values(sharedRjState.tasks)) check(!tasks.some(t => t.id === 'finish-next'), 'Shared completion cleared next day');

  saveSharedRjState = actualSharedSave;
  queueSharedRjSync = () => {};
  renderSaveStatus = () => {};
  renderSharedRjLists = () => {};
  supabaseUserId = 'test-user';
  for (const failure of [false, true]) {
    sharedChangesUnsaved = false; sharedRjSyncPending = false; sharedRjSyncInFlight = false;
    sharedRjRemoteAvailable = true;
    sharedRjState = { periodId: dailyPeriodId(new Date()), lastSavedAt: clock, tasks: { todo: [], schedule: [] } };
    persistSharedRjState();
    let resolve;
    supabaseClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(r => { resolve = r; }) }) }) }) };
    const loading = loadSharedRjPlannerState({ silent: true });
    sharedRjState.tasks.schedule.push({ id: 'new', text: 'Added during fetch', done: false });
    saveSharedRjState();
    sharedChangesUnsaved = false; // Also protect changes already synced before the read finishes.
    resolve(failure ? { error: { message: 'Network failure' } } : { data: { data: { lastSavedAt: '2099-01-01', tasks: { todo: [], schedule: [] } } } });
    await loading;
    check(sharedRjState.tasks.schedule.some(t => t.id === 'new'), 'Late ' + (failure ? 'failed' : 'successful') + ' read cannot erase a new task');
  }
  sharedRjSyncInFlight = true;
  supabaseClient = { from: () => { throw Error('Read must not start during a save'); } };
  await loadSharedRjPlannerState({ silent: true });
  check(true, 'Shared reads are blocked while a save is in flight');
  document.body.textContent = 'PASS\n' + results.join('\n');
})().catch(error => { document.body.textContent = 'FAIL\n' + error.stack; });
