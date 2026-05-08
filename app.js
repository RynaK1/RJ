const STORAGE_KEY = "schedms-data-v1";
const LIST_TYPES = ["daily", "weekly", "todo"];
const WEEKLY_RESET_DAY_UTC = 4;
const DEFAULT_TIMEZONE_OFFSET = "-08:00";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIMEZONE_OPTIONS = [
  ["-12:00", "UTC-12 (AoE)"],
  ["-11:00", "UTC-11 (SST)"],
  ["-10:00", "UTC-10 (HST)"],
  ["-09:00", "UTC-9 (AKST)"],
  ["-08:00", "UTC-8 (PST)"],
  ["-07:00", "UTC-7 (MST)"],
  ["-06:00", "UTC-6 (CST)"],
  ["-05:00", "UTC-5 (EST)"],
  ["-04:00", "UTC-4 (AST)"],
  ["-03:00", "UTC-3 (BRT)"],
  ["-02:00", "UTC-2 (South Georgia)"],
  ["-01:00", "UTC-1 (Azores)"],
  ["+00:00", "UTC+0 (GMT)"],
  ["+01:00", "UTC+1 (CET)"],
  ["+02:00", "UTC+2 (EET)"],
  ["+03:00", "UTC+3 (MSK)"],
  ["+04:00", "UTC+4 (GST)"],
  ["+05:00", "UTC+5 (PKT)"],
  ["+06:00", "UTC+6 (BST)"],
  ["+07:00", "UTC+7 (ICT)"],
  ["+08:00", "UTC+8 (AWST)"],
  ["+09:00", "UTC+9 (JST)"],
  ["+10:00", "UTC+10 (AEST)"],
  ["+11:00", "UTC+11 (SBT)"],
  ["+12:00", "UTC+12 (NZST/FJT)"],
  ["+13:00", "UTC+13 (NZDT/TOT)"],
  ["+14:00", "UTC+14 (LINT)"],
].filter(([offset]) => isWholeHourOffset(offset));

const defaultState = {
  settings: {
    timezoneOffset: DEFAULT_TIMEZONE_OFFSET,
    daylightSavingsAdjustment: 0,
  },
  periodIds: {
    daily: "",
    weekly: "",
  },
  filters: {
    daily: "unfinished",
    weekly: "unfinished",
    todo: "unfinished",
  },
  tasks: {
    daily: [],
    weekly: [],
    todo: [],
  },
};

let state = loadState();
let dragState = {
  listType: null,
  taskId: null,
  filter: null,
  insertIndex: null,
};
const pendingAppendAnimations = new Set();

const els = {
  views: {
    lists: document.getElementById("lists-view"),
    options: document.getElementById("options-view"),
  },
  topTabs: document.querySelectorAll(".top-tab"),
  statusTabs: document.querySelectorAll(".status-tab"),
  addForms: document.querySelectorAll(".add-task-form"),
  lists: {
    daily: {
      form: document.querySelector('.add-task-form[data-list="daily"]'),
      list: document.getElementById("daily-list"),
      empty: document.getElementById("daily-empty"),
      error: document.getElementById("daily-error"),
    },
    weekly: {
      form: document.querySelector('.add-task-form[data-list="weekly"]'),
      list: document.getElementById("weekly-list"),
      empty: document.getElementById("weekly-empty"),
      error: document.getElementById("weekly-error"),
    },
    todo: {
      form: document.querySelector('.add-task-form[data-list="todo"]'),
      list: document.getElementById("todo-list"),
      empty: document.getElementById("todo-empty"),
      error: document.getElementById("todo-error"),
    },
  },
  dailyResetLabel: document.getElementById("daily-reset-label"),
  weeklyResetLabel: document.getElementById("weekly-reset-label"),
  timezoneOffset: document.getElementById("timezone-offset"),
  dstAdjustment: document.getElementById("dst-adjustment"),
  saveStatus: document.getElementById("save-status"),
  bulkDeleteList: document.getElementById("bulk-delete-list"),
  bulkDeleteBtn: document.getElementById("bulk-delete-btn"),
};

initialize();

function initialize() {
  populateTimezoneOptions();
  hydrateSettingsUI();
  runResetsIfNeeded();
  wireEvents();
  window.setInterval(tickResets, 15000);
  renderAll();
}

function tickResets() {
  const beforeDaily = state.periodIds.daily;
  const beforeWeekly = state.periodIds.weekly;
  runResetsIfNeeded();

  if (beforeDaily !== state.periodIds.daily || beforeWeekly !== state.periodIds.weekly) {
    renderAll();
  }
}

function populateTimezoneOptions() {
  TIMEZONE_OPTIONS.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    els.timezoneOffset.appendChild(option);
  });
}

function wireEvents() {
  els.topTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.statusTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.filters[tab.dataset.list] = tab.dataset.filter;
      saveState();
      renderAll();
    });
  });

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const listType = form.dataset.list;
      const input = form.querySelector("input");
      const text = input.value.trim();

      if (text.length < 3) {
        setFormError(listType, "Task must be at least 3 characters.");
        return;
      }

      setFormError(listType, "");
      const taskId = crypto.randomUUID();

      state.tasks[listType].push({
        id: taskId,
        text,
        done: false,
      });
      pendingAppendAnimations.add(taskId);
      window.setTimeout(() => pendingAppendAnimations.delete(taskId), 500);

      input.value = "";
      saveState();
      renderAll();
    });
  });

  Object.entries(els.lists).forEach(([listType, listEls]) => {
    listEls.list.addEventListener("dragover", (event) => handleListDragOver(event, listType));
    listEls.list.addEventListener("drop", (event) => handleListDrop(event, listType));
    listEls.list.addEventListener("dragleave", (event) => {
      if (!listEls.list.contains(event.relatedTarget)) {
        clearDropIndicator();
      }
    });
  });

  els.timezoneOffset.addEventListener("change", () => {
    state.settings.timezoneOffset = els.timezoneOffset.value;
    saveState();
    runResetsIfNeeded();
    renderAll();
  });

  els.dstAdjustment.addEventListener("change", () => {
    state.settings.daylightSavingsAdjustment = els.dstAdjustment.checked ? 1 : 0;
    saveState();
    renderAll();
  });

  els.bulkDeleteBtn.addEventListener("click", () => {
    const listType = els.bulkDeleteList.value;
    const label = listType === "todo" ? "To-Do" : `${listType[0].toUpperCase()}${listType.slice(1)}`;
    const confirmed = window.confirm(`Delete all tasks in ${label}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    state.tasks[listType] = [];
    state.filters[listType] = "unfinished";
    saveState();
    renderAll();
  });
}

function setFormError(listType, message) {
  els.lists[listType].error.textContent = message;
}

function switchView(viewName) {
  Object.entries(els.views).forEach(([name, section]) => {
    section.classList.toggle("active", name === viewName);
  });

  els.topTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
}

function renderAll() {
  LIST_TYPES.forEach((listType) => {
    renderList(listType);
    syncStatusTabs(listType);
  });

  renderResetLabels();
}

function renderList(listType) {
  const taskSet = state.tasks[listType];
  const filter = state.filters[listType];
  const listEl = els.lists[listType].list;
  const emptyEl = els.lists[listType].empty;
  const formEl = els.lists[listType].form;
  emptyEl.classList.remove("during-final-exit");

  const unfinishedCount = taskSet.filter((task) => !task.done).length;
  const finishedCount = taskSet.length - unfinishedCount;
  updateTabCount(listType, unfinishedCount, finishedCount);

  formEl.style.display = filter === "finished" ? "none" : "flex";
  setFormError(listType, "");

  const filtered = taskSet.filter((task) => (filter === "unfinished" ? !task.done : task.done));
  listEl.innerHTML = "";

  filtered.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""}`;
    li.dataset.taskId = task.id;
    li.draggable = true;

    if (pendingAppendAnimations.has(task.id)) {
      li.classList.add("append-enter");
      li.addEventListener(
        "animationend",
        () => {
          pendingAppendAnimations.delete(task.id);
          li.classList.remove("append-enter");
        },
        { once: true }
      );
    }

    li.addEventListener("dragstart", (event) => {
      dragState = { listType, taskId: task.id, filter, insertIndex: null };
      li.classList.add("dragging");
      listEl.classList.add("drag-active");

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
      }
    });

    li.addEventListener("dragend", () => {
      cleanupDragState();
      li.classList.remove("dragging");
    });

    const label = document.createElement("label");
    label.className = "task-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;

    const text = document.createElement("span");
    text.className = "task-copy";
    text.textContent = task.text;

    label.append(checkbox, text);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "remove";
    deleteBtn.className = "delete-btn";

    checkbox.addEventListener("change", () => {
      const nextDone = checkbox.checked;
      const isLeavingCurrentTab =
        (filter === "unfinished" && nextDone && !task.done) || (filter === "finished" && !nextDone && task.done);

      if (isLeavingCurrentTab) {
        checkbox.disabled = true;
        deleteBtn.disabled = true;
        li.draggable = false;
        revealEmptyStateIfLastVisible(listType, filtered.length);

        runTaskExitAnimation(li, "complete-exit", () => {
          const beforePositions = captureTaskPositions(listType);
          task.done = nextDone;
          saveState();
          renderAll();
          animateListReflow(listType, beforePositions);
        });
        return;
      }

      task.done = nextDone;
      saveState();
      renderAll();
    });

    deleteBtn.addEventListener("click", () => {
      checkbox.disabled = true;
      deleteBtn.disabled = true;
      li.draggable = false;
      revealEmptyStateIfLastVisible(listType, filtered.length);

      runTaskExitAnimation(li, "remove-exit", () => {
        const beforePositions = captureTaskPositions(listType);
        state.tasks[listType] = state.tasks[listType].filter((item) => item.id !== task.id);
        saveState();
        renderAll();
        animateListReflow(listType, beforePositions);
      });
    });

    li.append(label, deleteBtn);
    listEl.appendChild(li);
  });

  emptyEl.style.display = filtered.length === 0 ? "block" : "none";
}

function revealEmptyStateIfLastVisible(listType, visibleCount) {
  if (visibleCount === 1) {
    const emptyEl = els.lists[listType].empty;
    emptyEl.style.display = "block";
    emptyEl.classList.add("during-final-exit");
  }
}

function captureTaskPositions(listType) {
  const positions = new Map();

  els.lists[listType].list.querySelectorAll(".task-item").forEach((itemEl) => {
    positions.set(itemEl.dataset.taskId, itemEl.getBoundingClientRect().top);
  });

  return positions;
}

function animateListReflow(listType, beforePositions) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  els.lists[listType].list.querySelectorAll(".task-item").forEach((itemEl) => {
    const previousTop = beforePositions.get(itemEl.dataset.taskId);

    if (previousTop === undefined) {
      return;
    }

    const deltaY = previousTop - itemEl.getBoundingClientRect().top;

    if (Math.abs(deltaY) < 1) {
      return;
    }

    itemEl.style.transition = "none";
    itemEl.style.transform = `translateY(${deltaY}px)`;

    window.requestAnimationFrame(() => {
      itemEl.style.transition = "transform 110ms ease-out";
      itemEl.style.transform = "";
      window.setTimeout(() => {
        itemEl.style.transition = "";
      }, 130);
    });
  });
}

function runTaskExitAnimation(itemEl, animationClass, onDone) {
  let finished = false;

  const finish = () => {
    if (finished) {
      return;
    }

    finished = true;
    onDone();
  };

  itemEl.style.setProperty("--task-exit-height", `${itemEl.scrollHeight}px`);
  itemEl.classList.add(animationClass, "is-exiting");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }

  itemEl.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, 360);
}

function handleListDragOver(event, listType) {
  if (dragState.listType !== listType || !dragState.taskId) {
    return;
  }

  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  const insertIndex = getDropInsertIndex(listType, event.clientY);
  dragState.insertIndex = insertIndex;
  renderDropIndicator(listType, insertIndex);
}

function handleListDrop(event, listType) {
  if (dragState.listType !== listType || !dragState.taskId) {
    return;
  }

  event.preventDefault();

  const insertIndex =
    dragState.insertIndex === null ? getDropInsertIndex(listType, event.clientY) : dragState.insertIndex;
  const beforePositions = captureTaskPositions(listType);

  reorderTaskToVisibleIndex(listType, dragState.filter, dragState.taskId, insertIndex);
  clearDropIndicator();
  saveState();
  renderAll();
  animateListReflow(listType, beforePositions);
  cleanupDragState();
}

function getDropInsertIndex(listType, clientY) {
  const taskItems = [...els.lists[listType].list.querySelectorAll(".task-item:not(.dragging)")];
  const targetIndex = taskItems.findIndex((itemEl) => {
    const rect = itemEl.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });

  return targetIndex === -1 ? taskItems.length : targetIndex;
}

function renderDropIndicator(listType, insertIndex) {
  const listEl = els.lists[listType].list;
  const taskItems = [...listEl.querySelectorAll(".task-item:not(.dragging)")];
  const upperTask = taskItems[insertIndex - 1];
  const lowerTask = taskItems[insertIndex];

  clearDropIndicatorClasses();

  listEl.classList.add("drag-active");

  if (upperTask) {
    upperTask.classList.add("drop-after");
  }

  if (lowerTask) {
    lowerTask.classList.add("drop-before");
  }
}

function clearDropIndicator() {
  clearDropIndicatorClasses();
  dragState.insertIndex = null;
}

function clearDropIndicatorClasses() {
  document.querySelectorAll(".task-item.drop-before, .task-item.drop-after").forEach((itemEl) => {
    itemEl.classList.remove("drop-before", "drop-after");
  });
}

function cleanupDragState() {
  clearDropIndicator();
  Object.values(els.lists).forEach(({ list }) => list.classList.remove("drag-active"));
  dragState = { listType: null, taskId: null, filter: null, insertIndex: null };
}

function reorderTaskToVisibleIndex(listType, filter, dragId, insertIndex) {
  const tasks = state.tasks[listType];
  const isVisibleTask = (task) => (filter === "unfinished" ? !task.done : task.done);
  const visibleTasks = tasks.filter(isVisibleTask);
  const fromIndex = visibleTasks.findIndex((task) => task.id === dragId);

  if (fromIndex < 0) {
    return;
  }

  const [moved] = visibleTasks.splice(fromIndex, 1);
  const boundedIndex = Math.max(0, Math.min(insertIndex, visibleTasks.length));
  visibleTasks.splice(boundedIndex, 0, moved);

  let visibleIndex = 0;
  state.tasks[listType] = tasks.map((task) => (isVisibleTask(task) ? visibleTasks[visibleIndex++] : task));
}

function updateTabCount(listType, unfinishedCount, finishedCount) {
  document.querySelector(`.status-tab[data-list="${listType}"][data-filter="unfinished"]`).textContent =
    `Unfinished (${unfinishedCount})`;
  document.querySelector(`.status-tab[data-list="${listType}"][data-filter="finished"]`).textContent =
    `Finished (${finishedCount})`;
}

function syncStatusTabs(listType) {
  const activeFilter = state.filters[listType];

  document.querySelectorAll(`.status-tab[data-list="${listType}"]`).forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === activeFilter);
  });
}

function hydrateSettingsUI() {
  els.timezoneOffset.value = state.settings.timezoneOffset;
  els.dstAdjustment.checked = state.settings.daylightSavingsAdjustment === 1;
}

function runResetsIfNeeded() {
  const now = new Date();
  const nextDailyPeriodId = dailyPeriodId(now);
  const nextWeeklyPeriodId = weeklyPeriodId(now);

  if (state.periodIds.daily !== nextDailyPeriodId) {
    state.periodIds.daily = nextDailyPeriodId;
    state.tasks.daily = state.tasks.daily.map((task) => ({ ...task, done: false }));
    state.filters.daily = "unfinished";
  }

  if (state.periodIds.weekly !== nextWeeklyPeriodId) {
    state.periodIds.weekly = nextWeeklyPeriodId;
    state.tasks.weekly = state.tasks.weekly.map((task) => ({ ...task, done: false }));
    state.filters.weekly = "unfinished";
  }

  saveState();
}

function isWholeHourOffset(offset) {
  return /^[+-]\d{2}:00$/.test(offset);
}

function normalizeTimezoneOffset(offset) {
  return TIMEZONE_OPTIONS.some(([value]) => value === offset) ? offset : DEFAULT_TIMEZONE_OFFSET;
}

function normalizeDstAdjustment(value) {
  const adjustment = Number(value);
  return [0, 1].includes(adjustment) ? adjustment : 0;
}

function parseOffsetToMinutes(offset) {
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours, minutes] = offset.replace("+", "").replace("-", "").split(":").map(Number);
  return sign * (hours * 60 + minutes);
}

function toTimezoneDate(date, offset, dstAdjustment = 0) {
  const displayOffsetMinutes = parseOffsetToMinutes(offset) + dstAdjustment * 60;
  return new Date(date.getTime() + displayOffsetMinutes * 60000);
}

function formatDateParts(dateObj) {
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dailyPeriodId(now) {
  return formatDateParts(now);
}

function weeklyPeriodId(now) {
  const pivot = new Date(now);
  const diffDays = (now.getUTCDay() - WEEKLY_RESET_DAY_UTC + 7) % 7;
  pivot.setUTCHours(0, 0, 0, 0);
  pivot.setUTCDate(now.getUTCDate() - diffDays);
  return formatDateParts(pivot);
}

function formatTime12h(hour24, minute) {
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function renderResetLabels() {
  const dailyReset = localResetParts(
    0,
    state.settings.timezoneOffset,
    state.settings.daylightSavingsAdjustment
  );
  const weeklyReset = localResetParts(
    WEEKLY_RESET_DAY_UTC,
    state.settings.timezoneOffset,
    state.settings.daylightSavingsAdjustment
  );

  els.dailyResetLabel.textContent = `Reset: ${dailyReset.time}`;
  els.weeklyResetLabel.textContent = `Reset: ${weeklyReset.time} ${weeklyReset.day}`;
}

function localResetParts(utcDay, offset, dstAdjustment) {
  const resetDate = new Date(Date.UTC(2024, 0, 7 + utcDay, 0, 0, 0));
  const localDate = toTimezoneDate(resetDate, offset, dstAdjustment);

  return {
    day: DAY_NAMES[localDate.getUTCDay()],
    time: formatTime12h(localDate.getUTCHours(), localDate.getUTCMinutes()),
  };
}

function normalizeFilter(filter) {
  return filter === "finished" ? "finished" : "unfinished";
}

function normalizeTaskSet(taskSet) {
  if (!Array.isArray(taskSet)) {
    return [];
  }

  return taskSet
    .map((task) => ({
      id: String(task?.id || crypto.randomUUID()),
      text: String(task?.text || "").trim(),
      done: Boolean(task?.done),
    }))
    .filter((task) => task.text.length > 0);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return structuredClone(defaultState);
    }

    const parsed = JSON.parse(raw);

    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: {
        timezoneOffset: normalizeTimezoneOffset(parsed?.settings?.timezoneOffset),
        daylightSavingsAdjustment: normalizeDstAdjustment(parsed?.settings?.daylightSavingsAdjustment),
      },
      periodIds: {
        ...defaultState.periodIds,
        ...parsed.periodIds,
      },
      filters: {
        daily: normalizeFilter(parsed?.filters?.daily),
        weekly: normalizeFilter(parsed?.filters?.weekly),
        todo: normalizeFilter(parsed?.filters?.todo),
      },
      tasks: {
        daily: normalizeTaskSet(parsed?.tasks?.daily),
        weekly: normalizeTaskSet(parsed?.tasks?.weekly),
        todo: normalizeTaskSet(parsed?.tasks?.todo),
      },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = `Auto-saved at ${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
