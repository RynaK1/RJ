const STORAGE_KEY = "schedms-data-v1";
const LIST_TYPES = ["daily", "weekly", "persistent"];
const RJ_LIST_TYPES = ["persistent"];
const LIST_SET_IDS = ["schedms", "rj"];
const DEFAULT_LIST_SET_ID = "schedms";
const MIN_RECURRING_INTERVAL_DAYS = 1;
const MAX_RECURRING_INTERVAL_DAYS = 7;
const MAX_TASK_TEXT_LENGTH = 100;
const RJ_TASK_GROUPS = ["recurring-open", "one-time-open", "one-time-done", "recurring-done"];
const LIST_SET_LABELS = {
  schedms: "SchedMS",
  rj: "R&J",
};
const ADD_TASK_SYMBOL = "+";
const SAVE_TASK_SYMBOL = "✓";
const DEFAULT_TIMEZONE_OFFSET = "-08:00";
const SCHEDMS_WEEKLY_RESET_DAY_UTC = 4;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RECURRING_PANEL_MOTION_MS = 130;
const RECURRING_FORM_MOTION_MS = 240;
const EDIT_TASK_MOTION_MS = 420;
const ADD_TASK_PLACEHOLDERS = {
  daily: "Add something for today",
  weekly: "Add weekly focus",
  persistent: "Add to-do item",
};
const EDIT_TASK_PLACEHOLDERS = {
  daily: "Edit daily task",
  weekly: "Edit weekly task",
  persistent: "Edit to-do item",
};

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
  activeListSet: DEFAULT_LIST_SET_ID,
  listSets: {
    schedms: createDefaultListSetState(),
    rj: createDefaultListSetState(),
  },
};

function createDefaultListSetState() {
  return {
    periodIds: {
      daily: "",
      weekly: "",
    },
    tasks: {
      daily: [],
      weekly: [],
      persistent: [],
    },
  };
}

function getActiveListSet() {
  return state.listSets[state.activeListSet];
}

function getListSetLabel(listSetId = state.activeListSet) {
  return LIST_SET_LABELS[normalizeListSetId(listSetId)];
}

function normalizeListSetId(listSetId) {
  return LIST_SET_IDS.includes(listSetId) ? listSetId : DEFAULT_LIST_SET_ID;
}

let state = loadState();
let dragState = {
  listType: null,
  taskId: null,
  insertIndex: null,
};
let dragAutoScrollState = {
  listType: null,
  frameId: null,
  lastClientY: null,
  speed: 0,
};
let editState = null;
let recurringPanelOpen = false;
let recurringPanelCloseTimer = null;
let recurringCreateMode = false;
const pendingAppendAnimations = new Set();

const els = {
  app: document.querySelector(".app"),
  settingsOpenBtn: document.getElementById("settings-open-btn"),
  settingsCloseBtn: document.getElementById("settings-close-btn"),
  settingsModal: document.getElementById("settings-modal"),
  rjProgress: document.querySelector(".rj-progress"),
  rjProgressFill: document.getElementById("rj-progress-fill"),
  rjProgressLabel: document.getElementById("rj-progress-label"),
  recurringTools: document.getElementById("recurring-tools"),
  recurringToggleBtn: document.getElementById("recurring-toggle-btn"),
  recurringForm: document.getElementById("recurring-form"),
  recurringInterval: document.getElementById("recurring-interval"),
  recurringShowDays: document.getElementById("recurring-show-days"),
  recurringError: document.getElementById("recurring-error"),
  recurringPanel: document.getElementById("recurring-panel"),
  recurringPanelToggle: document.getElementById("recurring-panel-toggle"),
  recurringPanelContent: document.getElementById("recurring-panel-content"),
  recurringPanelList: document.getElementById("recurring-panel-list"),
  recurringPanelEmpty: document.getElementById("recurring-panel-empty"),
  recurringPanelCount: document.getElementById("recurring-panel-count"),
  listSetButtons: document.querySelectorAll(".list-set-switch"),
  deleteListButtons: document.querySelectorAll(".list-delete-btn"),
  deleteConfirmPanels: document.querySelectorAll(".delete-confirm"),
  confirmDeleteButtons: document.querySelectorAll("[data-confirm-delete]"),
  cancelDeleteButtons: document.querySelectorAll("[data-cancel-delete]"),
  cancelEditButtons: document.querySelectorAll("[data-cancel-edit]"),
  addForms: document.querySelectorAll(".add-task-form"),
  lists: {
    daily: {
      card: document.querySelector('.todo-card[data-list="daily"]'),
      form: document.querySelector('.add-task-form[data-list="daily"]'),
      list: document.getElementById("daily-list"),
      empty: document.getElementById("daily-empty"),
      error: document.getElementById("daily-error"),
    },
    weekly: {
      card: document.querySelector('.todo-card[data-list="weekly"]'),
      form: document.querySelector('.add-task-form[data-list="weekly"]'),
      list: document.getElementById("weekly-list"),
      empty: document.getElementById("weekly-empty"),
      error: document.getElementById("weekly-error"),
    },
    persistent: {
      card: document.querySelector('.todo-card[data-list="persistent"]'),
      form: document.querySelector('.add-task-form[data-list="persistent"]'),
      list: document.getElementById("persistent-list"),
      empty: document.getElementById("persistent-empty"),
      error: document.getElementById("persistent-error"),
    },
  },
  dailyResetLabel: document.getElementById("daily-reset-label"),
  weeklyResetLabel: document.getElementById("weekly-reset-label"),
  timezoneOffset: document.getElementById("timezone-offset"),
  dstAdjustment: document.getElementById("dst-adjustment"),
  saveStatus: document.getElementById("save-status"),
};

initialize();

function initialize() {
  populateTimezoneOptions();
  populateRecurringShowDayOptions();
  updateRecurringShowDaysVisibility();
  hydrateSettingsUI();
  runTimedUpdatesIfNeeded();
  wireEvents();
  window.setInterval(tickResets, 15000);
  renderAll();
}

function tickResets() {
  if (runTimedUpdatesIfNeeded()) {
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

function populateRecurringShowDayOptions() {
  els.recurringShowDays.appendChild(createRecurringShowDayOption("Any", "any", true));

  DAY_SHORT_NAMES.forEach((dayName, dayIndex) => {
    els.recurringShowDays.appendChild(createRecurringShowDayOption(dayName, dayIndex, false));
  });
}

function createRecurringShowDayOption(labelText, value, checked) {
  const label = document.createElement("label");
  label.className = "day-chip";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = String(value);
  input.checked = checked;
  input.dataset.recurringShowDay = String(value);

  const text = document.createElement("span");
  text.textContent = labelText;

  label.append(input, text);
  return label;
}

function wireEvents() {
  els.settingsOpenBtn.addEventListener("click", openSettingsModal);
  els.settingsCloseBtn.addEventListener("click", closeSettingsModal);
  els.settingsModal.addEventListener("click", (event) => {
    if (event.target.dataset.settingsClose !== undefined) {
      closeSettingsModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.settingsModal.hidden) {
      closeSettingsModal();
    }
  });

  els.listSetButtons.forEach((button) => {
    button.addEventListener("click", () => switchListSet(button.dataset.listSet));
  });

  els.recurringToggleBtn.addEventListener("click", toggleRecurringForm);
  els.recurringInterval.addEventListener("change", handleRecurringIntervalChange);
  els.recurringShowDays.addEventListener("change", handleRecurringShowDayChange);
  els.recurringPanel.addEventListener("pointerenter", openRecurringPanel);
  els.recurringPanel.addEventListener("pointerleave", closeRecurringPanel);
  els.recurringPanel.addEventListener("focusin", openRecurringPanel);
  els.recurringPanel.addEventListener("focusout", closeRecurringPanelAfterFocusLeaves);
  els.recurringPanelToggle.addEventListener("click", handleRecurringPanelToggleClick);

  els.deleteListButtons.forEach((button) => {
    button.addEventListener("click", () => showDeleteConfirm(button.dataset.deleteList));
  });

  els.confirmDeleteButtons.forEach((button) => {
    button.addEventListener("click", () => deleteAllTasks(button.dataset.confirmDelete));
  });

  els.cancelDeleteButtons.forEach((button) => {
    button.addEventListener("click", () => hideDeleteConfirm(button.dataset.cancelDelete));
  });

  els.cancelEditButtons.forEach((button) => {
    button.addEventListener("click", () => cancelTaskEdit(button.dataset.cancelEdit));
  });

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handleTaskFormSubmit(form);
    });
  });

  Object.entries(els.lists).forEach(([listType, listEls]) => {
    listEls.card.addEventListener("dragover", (event) => handleListDragOver(event, listType));
    listEls.card.addEventListener("drop", (event) => handleListDrop(event, listType));
    listEls.card.addEventListener("dragleave", (event) => {
      if (!isPointInsideElement(event.clientX, event.clientY, listEls.card)) {
        clearDropIndicator();
      }
    });
  });

  els.timezoneOffset.addEventListener("change", () => {
    state.settings.timezoneOffset = els.timezoneOffset.value;
    saveState();
    runTimedUpdatesIfNeeded();
    renderAll();
  });

  els.dstAdjustment.addEventListener("change", () => {
    state.settings.daylightSavingsAdjustment = els.dstAdjustment.checked ? 1 : 0;
    saveState();
    runTimedUpdatesIfNeeded();
    renderAll();
  });

}

function handleTaskFormSubmit(form) {
  const listType = form.dataset.list;
  const input = getTaskInput(listType);
  const text = input.value.trim().slice(0, MAX_TASK_TEXT_LENGTH);
  const isRecurringSubmit = isRecurringCreateModeForList(listType);
  const isEditing = isEditingTask(listType);

  if (text.length < 1) {
    setFormError(listType, "Task must be at least 1 character.");
    return;
  }

  setFormError(listType, "");
  setRecurringError("");

  if (isEditing) {
    updateEditedTask(listType, text, isRecurringSubmit);
    return;
  }

  addNewTask(listType, text, isRecurringSubmit);
}

function addNewTask(listType, text, isRecurringSubmit) {
  const taskId = crypto.randomUUID();
  const activeSet = getActiveListSet();

  if (isRecurringSubmit) {
    activeSet.tasks.persistent.unshift(createRecurringTask(taskId, text));
  } else {
    activeSet.tasks[listType].push({
      id: taskId,
      text,
      done: false,
    });
  }

  pendingAppendAnimations.add(taskId);
  window.setTimeout(() => pendingAppendAnimations.delete(taskId), 500);

  getTaskInput(listType).value = "";
  resetRecurringShowDayControls();
  saveState();
  renderAll();
}

function updateEditedTask(listType, text, isRecurringSubmit) {
  const activeSet = getActiveListSet();
  const task = activeSet.tasks[listType].find((item) => item.id === editState.taskId);

  if (!task) {
    cancelTaskEdit(listType);
    return;
  }

  const beforePositions = captureTaskPositions(listType);
  const wasRecurring = isRecurringTask(task);

  task.text = text;

  if (usesRecurringTaskGrouping(listType) && isRecurringSubmit) {
    applyRecurringTaskFields(task, !wasRecurring);
  } else if (usesRecurringTaskGrouping(listType) && wasRecurring) {
    clearRecurringTaskFields(task);
  }

  activeSet.tasks[listType] = orderTasksForList(listType, activeSet.tasks[listType]);
  finishTaskEdit(listType);
  saveState();
  renderAll();
  animateListReflow(listType, beforePositions);
}

function createRecurringTask(taskId, text) {
  const task = {
    id: taskId,
    text,
    done: false,
  };

  applyRecurringTaskFields(task, true);
  return task;
}

function applyRecurringTaskFields(task, shouldResetDone) {
  const todayId = dailyPeriodId(new Date());
  const intervalDays = normalizeRecurringIntervalDays(els.recurringInterval.value);

  task.recurring = true;
  task.intervalDays = intervalDays;
  task.showDays = intervalDays === 7 ? getSelectedRecurringShowDays() : [];
  task.recurringStartDate = todayId;
  task.nextDueDate = addDaysToDateId(todayId, intervalDays);

  if (shouldResetDone) {
    task.done = false;
    task.lastCompletedDate = "";
    delete task.lastRestoredDate;
  }
}

function clearRecurringTaskFields(task) {
  delete task.recurring;
  delete task.intervalDays;
  delete task.showDays;
  delete task.recurringStartDate;
  delete task.lastCompletedDate;
  delete task.lastRestoredDate;
  delete task.nextDueDate;
}

function setFormError(listType, message) {
  els.lists[listType].error.textContent = message;
}

function switchListSet(listSetId) {
  const nextListSetId = normalizeListSetId(listSetId);

  if (state.activeListSet === nextListSetId) {
    return;
  }

  cleanupDragState();
  hideDeleteConfirm();
  cancelTaskEdit();
  state.activeListSet = nextListSetId;
  runTimedUpdatesIfNeeded();
  saveState();
  renderAll();
}

function openSettingsModal() {
  els.settingsModal.hidden = false;
  els.settingsOpenBtn.setAttribute("aria-expanded", "true");
  els.settingsCloseBtn.focus();
}

function closeSettingsModal() {
  els.settingsModal.hidden = true;
  els.settingsOpenBtn.setAttribute("aria-expanded", "false");
  hideDeleteConfirm();
  els.settingsOpenBtn.focus();
}

function toggleRecurringForm() {
  setRecurringCreateMode(!recurringCreateMode);
}

function setRecurringCreateMode(isActive) {
  recurringCreateMode = Boolean(isActive);
  els.recurringForm.hidden = !recurringCreateMode;
  els.recurringToggleBtn.classList.toggle("active", recurringCreateMode);
  els.recurringToggleBtn.setAttribute("aria-expanded", String(recurringCreateMode));
  els.recurringToggleBtn.textContent = recurringCreateMode ? "Make one-time" : "Make recurring";
  els.lists.persistent.form.classList.toggle("recurring-create-mode", recurringCreateMode);
  updateRecurringShowDaysVisibility();
  updateTaskInputPlaceholder("persistent");
  setRecurringError("");
}

function closeRecurringForm() {
  setRecurringCreateMode(false);
}

function getTaskInput(listType) {
  return els.lists[listType].form.querySelector("input");
}

function getTaskSubmitButton(listType) {
  return els.lists[listType].form.querySelector(".add-task-submit-btn");
}

function getTaskEditCancelButton(listType) {
  return els.lists[listType].form.querySelector("[data-cancel-edit]");
}

function isEditingTask(listType, taskId = null) {
  if (!editState || editState.listSetId !== state.activeListSet || editState.listType !== listType) {
    return false;
  }

  return taskId === null || editState.taskId === taskId;
}

function getListTypeTaskLabel(listType) {
  if (listType === "persistent") {
    return "to-do task";
  }

  return `${listType} task`;
}

function updateTaskInputPlaceholder(listType) {
  const input = getTaskInput(listType);

  if (isEditingTask(listType)) {
    input.placeholder =
      listType === "persistent" && recurringCreateMode ? "Edit recurring to-do item" : EDIT_TASK_PLACEHOLDERS[listType];
    return;
  }

  input.placeholder =
    listType === "persistent" && isRecurringCreateModeForList(listType)
      ? "Add recurring to-do item"
      : ADD_TASK_PLACEHOLDERS[listType];
}

function setTaskFormEditingState(listType, isEditing) {
  const form = els.lists[listType].form;
  const submitButton = getTaskSubmitButton(listType);
  const cancelButton = getTaskEditCancelButton(listType);
  const taskLabel = getListTypeTaskLabel(listType);

  cancelButton.hidden = false;
  cancelButton.disabled = !isEditing;
  cancelButton.setAttribute("aria-hidden", String(!isEditing));
  cancelButton.tabIndex = isEditing ? 0 : -1;
  form.classList.toggle("editing-task", isEditing);
  submitButton.textContent = isEditing ? SAVE_TASK_SYMBOL : ADD_TASK_SYMBOL;
  submitButton.setAttribute("aria-label", isEditing ? `Save ${taskLabel}` : `Add ${taskLabel}`);
  submitButton.title = isEditing ? "Save task" : "Add task";
  updateTaskInputPlaceholder(listType);
}

function prepareTaskEditMode(listType, task) {
  const taskId = task.id;

  if (editState && !isEditingTask(listType, taskId)) {
    finishTaskEdit(editState.listType);
  }

  editState = {
    listSetId: state.activeListSet,
    listType,
    taskId,
  };

  const input = getTaskInput(listType);
  input.value = task.text.slice(0, MAX_TASK_TEXT_LENGTH);

  if (usesRecurringTaskGrouping(listType)) {
    setRecurringCreateMode(isRecurringTask(task));
    hydrateRecurringControlsFromTask(task);
  } else {
    updateTaskInputPlaceholder(listType);
  }

  setTaskFormEditingState(listType, true);
}

function enterTaskEditMode(listType, taskId) {
  const task = getActiveListSet().tasks[listType].find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  prepareTaskEditMode(listType, task);
  renderAll();
  focusTaskEditInput(listType);
}

function focusTaskEditInput(listType) {
  const input = getTaskInput(listType);
  window.requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function finishTaskEdit(listType = editState?.listType) {
  if (!listType) {
    editState = null;
    return;
  }

  editState = null;
  getTaskInput(listType).value = "";
  resetRecurringShowDayControls();

  if (listType === "persistent") {
    closeRecurringForm();
  }

  setTaskFormEditingState(listType, false);
}

function cancelTaskEdit(listType = null) {
  if (!editState || (listType && !isEditingTask(listType))) {
    return;
  }

  const editedListType = editState.listType;
  finishTaskEdit(editedListType);
  setFormError(editedListType, "");
  setRecurringError("");
  renderAll();
}

function hydrateRecurringControlsFromTask(task) {
  els.recurringInterval.value = String(normalizeRecurringIntervalDays(task?.intervalDays));
  setRecurringShowDayControls(normalizeRecurringShowDays(task?.showDays));
  updateRecurringShowDaysVisibility();
}

function setRecurringShowDayControls(showDays) {
  const normalizedShowDays = normalizeRecurringShowDays(showDays);
  const anyInput = getRecurringAnyDayInput();

  anyInput.checked = normalizedShowDays.length === 0;
  getRecurringShowDayInputs().forEach((input) => {
    input.checked = normalizedShowDays.includes(Number(input.value));
  });
}

function isRecurringCreateModeForList(listType) {
  return state.activeListSet === "rj" && listType === "persistent" && recurringCreateMode;
}

function openRecurringPanel() {
  setRecurringPanelOpen(true);
}

function closeRecurringPanel() {
  setRecurringPanelOpen(false);
}

function closeRecurringPanelAfterFocusLeaves(event) {
  if (event.relatedTarget && els.recurringPanel.contains(event.relatedTarget)) {
    return;
  }

  closeRecurringPanel();
}

function handleRecurringPanelToggleClick() {
  if (window.matchMedia("(hover: hover)").matches) {
    openRecurringPanel();
    return;
  }

  setRecurringPanelOpen(!recurringPanelOpen);
}

function setRecurringPanelOpen(isOpen) {
  const nextOpen = Boolean(isOpen);
  const wasOpen = recurringPanelOpen;

  recurringPanelOpen = nextOpen;
  els.app.classList.toggle("recurring-open", nextOpen);
  els.recurringPanelToggle.setAttribute("aria-expanded", String(recurringPanelOpen));

  if (nextOpen) {
    if (recurringPanelCloseTimer !== null) {
      window.clearTimeout(recurringPanelCloseTimer);
      recurringPanelCloseTimer = null;
    }

    els.app.classList.remove("recurring-closing");
    els.recurringPanel.classList.remove("closing");
    els.recurringPanelContent.hidden = false;

    if (!wasOpen || !els.recurringPanel.classList.contains("open")) {
      els.recurringPanel.classList.remove("open");
      void els.recurringPanelContent.offsetWidth;
    }

    els.recurringPanel.classList.add("open");
    return;
  }

  els.recurringPanel.classList.remove("open");
  els.recurringPanel.classList.add("closing");

  if (wasOpen) {
    els.app.classList.add("recurring-closing");

    if (recurringPanelCloseTimer !== null) {
      window.clearTimeout(recurringPanelCloseTimer);
    }

    recurringPanelCloseTimer = window.setTimeout(() => {
      els.app.classList.remove("recurring-closing");
      els.recurringPanel.classList.remove("closing");
      els.recurringPanelContent.hidden = true;
      recurringPanelCloseTimer = null;
    }, RECURRING_PANEL_MOTION_MS);
  } else {
    els.recurringPanel.classList.remove("closing");
    els.recurringPanelContent.hidden = true;
  }
}

function handleRecurringShowDayChange(event) {
  if (!event.target.matches("[data-recurring-show-day]")) {
    return;
  }

  const anyInput = getRecurringAnyDayInput();
  const dayInputs = getRecurringShowDayInputs();

  if (event.target === anyInput) {
    if (!anyInput.checked && !dayInputs.some((input) => input.checked)) {
      anyInput.checked = true;
      return;
    }

    if (anyInput.checked) {
      dayInputs.forEach((input) => {
        input.checked = false;
      });
    }

    return;
  }

  if (event.target.checked) {
    anyInput.checked = false;
  }

  if (!dayInputs.some((input) => input.checked)) {
    anyInput.checked = true;
  }
}

function handleRecurringIntervalChange() {
  els.recurringInterval.value = String(normalizeRecurringIntervalDays(els.recurringInterval.value));

  if (!isWeeklyRecurringSelection()) {
    resetRecurringShowDayControls();
  }

  updateRecurringShowDaysVisibility();
}

function isWeeklyRecurringSelection() {
  return normalizeRecurringIntervalDays(els.recurringInterval.value) === 7;
}

function updateRecurringShowDaysVisibility() {
  const isVisible = recurringCreateMode && isWeeklyRecurringSelection();
  const field = els.recurringShowDays.closest(".recurring-days-field");
  const wasVisible = els.recurringForm.classList.contains("show-days-open");
  const shouldAnimate = shouldAnimateRecurringFormToggle(field, wasVisible, isVisible);
  const beforeSelectRect = shouldAnimate ? els.recurringInterval.getBoundingClientRect() : null;
  const beforeFieldRect = shouldAnimate ? field.getBoundingClientRect() : null;

  if (shouldAnimate) {
    els.recurringForm.classList.add("recurring-form-measuring");
  }

  els.recurringForm.classList.toggle("show-days-open", isVisible);
  field?.classList.toggle("show-days-open", isVisible);
  field?.setAttribute("aria-hidden", String(!isVisible));

  [...els.recurringShowDays.querySelectorAll("input")].forEach((input) => {
    input.disabled = !isVisible;
  });

  if (shouldAnimate) {
    const afterSelectRect = els.recurringInterval.getBoundingClientRect();
    const afterFieldRect = field.getBoundingClientRect();

    els.recurringForm.classList.remove("recurring-form-measuring");
    animateRecurringFormToggle(field, beforeSelectRect, beforeFieldRect, afterSelectRect, afterFieldRect, isVisible);
  }
}

function shouldAnimateRecurringFormToggle(field, wasVisible, isVisible) {
  return (
    wasVisible !== isVisible &&
    Boolean(field) &&
    els.recurringForm.isConnected &&
    !els.recurringForm.hidden &&
    els.recurringForm.getClientRects().length > 0 &&
    typeof els.recurringInterval.animate === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function animateRecurringFormToggle(field, beforeSelectRect, beforeFieldRect, afterSelectRect, afterFieldRect, isVisible) {
  const selectDeltaX = beforeSelectRect.left - afterSelectRect.left;
  const selectDeltaY = beforeSelectRect.top - afterSelectRect.top;

  if (Math.abs(selectDeltaX) > 0.5 || Math.abs(selectDeltaY) > 0.5) {
    els.recurringInterval.animate(
      [
        { transform: `translate3d(${selectDeltaX}px, ${selectDeltaY}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration: RECURRING_FORM_MOTION_MS,
        easing: "cubic-bezier(0.22, 0.72, 0.2, 1)",
      }
    );
  }

  if (typeof field.animate !== "function") {
    return;
  }

  const fieldDeltaX = beforeFieldRect.left - afterFieldRect.left;
  const fieldStartX = isVisible ? Math.min(fieldDeltaX, -8) : 0;
  const fieldEndX = isVisible ? 0 : Math.min(fieldDeltaX, -8);

  field.animate(
    [
      {
        opacity: isVisible ? 0 : 1,
        transform: `translate3d(${fieldStartX}px, 0, 0)`,
      },
      {
        opacity: isVisible ? 1 : 0,
        transform: `translate3d(${fieldEndX}px, 0, 0)`,
      },
    ],
    {
      duration: RECURRING_FORM_MOTION_MS,
      easing: "cubic-bezier(0.22, 0.72, 0.2, 1)",
    }
  );
}

function getRecurringAnyDayInput() {
  return els.recurringShowDays.querySelector('[data-recurring-show-day="any"]');
}

function getRecurringShowDayInputs() {
  return [...els.recurringShowDays.querySelectorAll('[data-recurring-show-day]:not([data-recurring-show-day="any"])')];
}

function getSelectedRecurringShowDays() {
  if (getRecurringAnyDayInput().checked) {
    return [];
  }

  return normalizeRecurringShowDays(
    getRecurringShowDayInputs()
      .filter((input) => input.checked)
      .map((input) => input.value)
  );
}

function resetRecurringShowDayControls() {
  getRecurringAnyDayInput().checked = true;
  getRecurringShowDayInputs().forEach((input) => {
    input.checked = false;
  });
}

function setRecurringError(message) {
  els.recurringError.textContent = message;
}

function showDeleteConfirm(listType) {
  if (!LIST_TYPES.includes(listType)) {
    return;
  }

  let activePanel = null;
  els.deleteConfirmPanels.forEach((panel) => {
    const isActive = panel.dataset.confirmList === listType;
    panel.hidden = !isActive;
    panel.closest(".delete-control")?.classList.toggle("confirming", isActive);
    panel.closest(".card-meta")?.classList.toggle("confirming", isActive);

    if (isActive) {
      activePanel = panel;
    }
  });

  activePanel?.querySelector("[data-cancel-delete]")?.focus();
}

function hideDeleteConfirm(listType = null) {
  let restoredButton = null;
  els.deleteConfirmPanels.forEach((panel) => {
    if (!listType || panel.dataset.confirmList === listType) {
      panel.hidden = true;
      const control = panel.closest(".delete-control");
      panel.closest(".card-meta")?.classList.remove("confirming");
      control?.classList.remove("confirming");

      if (listType) {
        restoredButton = control?.querySelector("[data-delete-list]");
      }
    }
  });

  restoredButton?.focus();
}

function deleteAllTasks(listType) {
  if (!LIST_TYPES.includes(listType)) {
    return;
  }

  const activeSet = getActiveListSet();
  activeSet.tasks[listType] = [];
  if (isEditingTask(listType)) {
    finishTaskEdit(listType);
  }
  hideDeleteConfirm(listType);
  saveState();
  renderAll();
}

function renderAll() {
  renderActiveLayout();
  renderListSetSwitcher();

  LIST_TYPES.forEach((listType) => {
    renderList(listType);
  });

  renderRecurringPanel();
  renderResetLabels();
}

function renderActiveLayout() {
  const isRjMode = state.activeListSet === "rj";

  document.body.classList.toggle("rj-mode", isRjMode);
  els.app.classList.toggle("rj-mode", isRjMode);
  els.rjProgress.hidden = !isRjMode;
  els.recurringTools.hidden = !isRjMode;
  els.recurringPanel.hidden = !isRjMode;
  els.lists.daily.card.hidden = isRjMode;
  els.lists.weekly.card.hidden = isRjMode;

  if (!isRjMode) {
    closeRecurringForm();
    setRecurringPanelOpen(false);
  }

  if (isRjMode) {
    setRecurringPanelOpen(recurringPanelOpen);
    renderRjProgress();
  }
}

function renderListSetSwitcher() {
  els.listSetButtons.forEach((button) => {
    const isActive = button.dataset.listSet === state.activeListSet;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderRjProgress() {
  const tasks = RJ_LIST_TYPES.flatMap((listType) => getVisibleTasksForList(listType, getActiveListSet().tasks[listType]));
  const totalCount = tasks.length;
  const finishedCount = tasks.filter((task) => task.done).length;
  const progress = totalCount === 0 ? 0 : Math.round((finishedCount / totalCount) * 100);

  els.rjProgressFill.style.width = `${progress}%`;
  els.rjProgressLabel.textContent = `${progress}%`;
  els.rjProgress.querySelector(".progress-track").setAttribute("aria-valuenow", String(progress));
}

function renderList(listType) {
  const activeSet = getActiveListSet();
  const taskSet = activeSet.tasks[listType];
  const listEl = els.lists[listType].list;
  const emptyEl = els.lists[listType].empty;
  const formEl = els.lists[listType].form;

  activeSet.tasks[listType] = orderTasksForList(listType, taskSet);
  const visibleTasks = getVisibleTasksForList(listType, activeSet.tasks[listType]);
  formEl.style.display = "flex";
  setFormError(listType, "");

  listEl.innerHTML = "";

  visibleTasks.forEach((task) => {
    const isTaskEditing = isEditingTask(listType, task.id);
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""} ${isRecurringTask(task) ? "recurring-task" : ""}`;
    li.dataset.taskId = task.id;
    li.dataset.recurring = String(isRecurringTask(task));
    li.dataset.taskGroup = getRjTaskGroup(task);
    li.draggable = !isTaskEditing;

    if (isTaskEditing) {
      li.classList.add("editing");
    }

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
      dragState = { listType, taskId: task.id, insertIndex: null };
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

    let repeatBadge = null;

    if (isRecurringTask(task)) {
      const daysLeftText = formatRecurringDaysLeft(task);

      if (daysLeftText) {
        const daysLeft = document.createElement("span");
        daysLeft.className = "task-days-left";
        daysLeft.textContent = daysLeftText;
        label.appendChild(daysLeft);
      }

      repeatBadge = document.createElement("span");
      repeatBadge.className = "task-badge";
      repeatBadge.textContent = formatRecurringListBadge(task);
      repeatBadge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "task-action-btn edit-btn";
    editBtn.setAttribute("aria-label", `Edit task: ${task.text}`);
    editBtn.title = "Edit task";

    const editIcon = document.createElement("span");
    editIcon.className = "edit-icon";
    editIcon.setAttribute("aria-hidden", "true");
    editBtn.appendChild(editIcon);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-action-btn delete-btn";
    deleteBtn.setAttribute("aria-label", `Remove task: ${task.text}`);
    deleteBtn.title = "Remove task";

    const trashIcon = document.createElement("span");
    trashIcon.className = "trash-icon";
    trashIcon.setAttribute("aria-hidden", "true");
    deleteBtn.appendChild(trashIcon);

    actions.append(editBtn, deleteBtn);

    if (isTaskEditing) {
      checkbox.disabled = true;
      editBtn.disabled = true;
      deleteBtn.disabled = true;
    }

    let taskActionStarted = false;
    let taskPointerStart = null;

    const setTaskDone = (nextDone) => {
      if (taskActionStarted) {
        return;
      }

      if (task.done === nextDone) {
        return;
      }

      taskActionStarted = true;

      const commitDoneChange = () => {
        const beforePositions = captureTaskPositions(listType);
        moveTaskAfterDoneChange(listType, task.id, nextDone);
        saveState();
        renderAll();
        animateListReflow(listType, beforePositions);
      };

      if (nextDone && usesRecurringTaskGrouping(listType) && isRecurringTask(task)) {
        checkbox.checked = true;
        checkbox.disabled = true;
        deleteBtn.disabled = true;
        editBtn.disabled = true;
        li.draggable = false;
        runRecurringCompleteAnimation(li, commitDoneChange);
        return;
      }

      commitDoneChange();
    };

    li.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || checkbox.disabled || event.target.closest(".task-action-btn")) {
        return;
      }

      taskPointerStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    });

    li.addEventListener("pointerup", (event) => {
      if (
        event.button !== 0 ||
        checkbox.disabled ||
        !taskPointerStart ||
        taskPointerStart.pointerId !== event.pointerId ||
        event.target.closest(".task-action-btn")
      ) {
        taskPointerStart = null;
        return;
      }

      const movedX = Math.abs(event.clientX - taskPointerStart.x);
      const movedY = Math.abs(event.clientY - taskPointerStart.y);
      taskPointerStart = null;

      if (movedX > 6 || movedY > 6) {
        return;
      }

      event.preventDefault();
      setTaskDone(!checkbox.checked);
    });

    li.addEventListener("pointercancel", () => {
      taskPointerStart = null;
    });

    checkbox.addEventListener("change", () => {
      setTaskDone(checkbox.checked);
    });

    const deleteTask = () => {
      if (taskActionStarted) {
        return;
      }

      taskActionStarted = true;
      checkbox.disabled = true;
      deleteBtn.disabled = true;
      editBtn.disabled = true;
      li.draggable = false;
      activeSet.tasks[listType] = activeSet.tasks[listType].filter((item) => item.id !== task.id);
      saveState();
      emptyEl.style.display = "none";

      runTaskExitAnimation(li, "remove-exit", () => {
        removeExitedTaskItem(listType, li);
      });
    };

    const editTask = () => {
      if (taskActionStarted) {
        return;
      }

      taskActionStarted = true;
      checkbox.disabled = true;
      deleteBtn.disabled = true;
      editBtn.disabled = true;
      li.draggable = false;
      setFormError(listType, "");
      setRecurringError("");

      const editListSetId = state.activeListSet;
      runTaskEditAnimation(li, listType, task, () => {
        if (state.activeListSet !== editListSetId) {
          return;
        }

        focusTaskEditInput(listType);
      });
    };

    editBtn.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || editBtn.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      editTask();
    });

    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      editTask();
    });

    deleteBtn.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || deleteBtn.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      deleteTask();
    });

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteTask();
    });

    li.append(label);

    if (repeatBadge) {
      li.append(repeatBadge, actions);
    } else {
      li.appendChild(actions);
    }
    listEl.appendChild(li);
  });

  emptyEl.style.display = visibleTasks.length === 0 ? "block" : "none";
}

function renderRecurringPanel() {
  const recurringTasks =
    state.activeListSet === "rj" ? getActiveListSet().tasks.persistent.filter((task) => isRecurringTask(task)) : [];

  els.recurringPanelCount.textContent = String(recurringTasks.length);
  els.recurringPanelList.innerHTML = "";

  recurringTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = `recurring-summary-item ${task.done ? "done" : ""} ${
      doesRecurringTaskShowToday(task) ? "is-active" : ""
    }`;

    const copy = document.createElement("div");
    copy.className = "recurring-summary-copy";

    const title = document.createElement("span");
    title.className = "recurring-summary-title";
    title.textContent = task.text;

    const meta = document.createElement("span");
    meta.className = "recurring-summary-meta";
    meta.textContent = formatRecurringPanelMeta(task);

    const status = shouldShowRecurringPanelStatusBadge(task) ? document.createElement("span") : null;

    if (status) {
      status.className = `recurring-summary-status ${task.done ? "done" : ""} ${
        doesRecurringTaskShowToday(task) ? "active" : ""
      }`;
      status.textContent = formatRecurringPanelStatus(task);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-action-btn delete-btn recurring-summary-delete";
    deleteBtn.setAttribute("aria-label", `Remove recurring task: ${task.text}`);
    deleteBtn.title = "Remove recurring task";

    const trashIcon = document.createElement("span");
    trashIcon.className = "trash-icon";
    trashIcon.setAttribute("aria-hidden", "true");
    deleteBtn.appendChild(trashIcon);
    let didDelete = false;

    const deleteRecurringTask = () => {
      if (didDelete) {
        return;
      }

      didDelete = true;
      const activeSet = getActiveListSet();
      activeSet.tasks.persistent = activeSet.tasks.persistent.filter((item) => item.id !== task.id);
      saveState();
      renderAll();
    };

    const restoreRecurringTask = () => {
      if (!task.done || didDelete) {
        return;
      }

      const beforePositions = captureTaskPositions("persistent");
      moveTaskAfterDoneChange("persistent", task.id, false);
      saveState();
      renderAll();
      animateListReflow("persistent", beforePositions);
    };

    if (task.done) {
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.setAttribute("aria-label", `Show recurring task on To-Do list: ${task.text}`);
      li.title = "Show on To-Do list";
    }

    deleteBtn.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || deleteBtn.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      deleteRecurringTask();
    });

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteRecurringTask();
    });

    li.addEventListener("click", (event) => {
      if (event.target.closest(".task-action-btn")) {
        return;
      }

      restoreRecurringTask();
    });

    li.addEventListener("keydown", (event) => {
      if (event.target.closest(".task-action-btn") || !["Enter", " "].includes(event.key)) {
        return;
      }

      event.preventDefault();
      restoreRecurringTask();
    });

    copy.append(title, meta);
    li.append(copy);

    if (status) {
      li.appendChild(status);
    }

    li.appendChild(deleteBtn);
    els.recurringPanelList.appendChild(li);
  });

  els.recurringPanelEmpty.style.display = recurringTasks.length === 0 ? "block" : "none";
}

function orderTasksForList(listType, tasks) {
  if (!usesRecurringTaskGrouping(listType)) {
    return orderTasksByDone(tasks);
  }

  return orderRjPersistentTasks(tasks);
}

function orderRjPersistentTasks(tasks) {
  return RJ_TASK_GROUPS.flatMap((group) => tasks.filter((task) => getRjTaskGroup(task) === group));
}

function getVisibleTasksForList(listType, tasks) {
  if (isSchedmsTimedList(listType)) {
    return tasks;
  }

  return tasks.filter((task) => isTaskVisibleInList(listType, task));
}

function isTaskVisibleInList(listType, task) {
  if (!usesRecurringTaskGrouping(listType) || !isRecurringTask(task)) {
    return true;
  }

  const wasRestoredToday = normalizeDateId(task.lastRestoredDate) === dailyPeriodId(new Date());

  return !task.done && (wasRestoredToday || doesRecurringTaskShowToday(task));
}

function isSchedmsTimedList(listType) {
  return state.activeListSet === "schedms" && (listType === "daily" || listType === "weekly");
}

function usesRecurringTaskGrouping(listType) {
  return state.activeListSet === "rj" && listType === "persistent";
}

function isRecurringTask(task) {
  return task?.recurring === true;
}

function getRjTaskGroup(task) {
  if (isRecurringTask(task)) {
    return task.done ? "recurring-done" : "recurring-open";
  }

  return task.done ? "one-time-done" : "one-time-open";
}

function orderTasksByDone(tasks) {
  return [...tasks.filter((task) => !task.done), ...tasks.filter((task) => task.done)];
}

function moveTaskAfterDoneChange(listType, taskId, done) {
  const activeSet = getActiveListSet();
  const tasks = activeSet.tasks[listType];
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex < 0) {
    return;
  }

  const [task] = tasks.splice(taskIndex, 1);
  task.done = done;

  if (usesRecurringTaskGrouping(listType) && isRecurringTask(task)) {
    if (done) {
      task.lastCompletedDate = dailyPeriodId(new Date());
      task.recurringStartDate = normalizeDateId(task.recurringStartDate) || task.lastCompletedDate;
      task.nextDueDate = normalizeDateId(task.nextDueDate) || addDaysToDateId(task.recurringStartDate, task.intervalDays);
      delete task.lastRestoredDate;
    } else {
      const todayId = dailyPeriodId(new Date());
      task.recurringStartDate = todayId;
      task.lastRestoredDate = todayId;
      task.nextDueDate = addDaysToDateId(task.recurringStartDate, task.intervalDays);
    }

    activeSet.tasks[listType] = orderTasksForList(listType, [task, ...tasks]);
    return;
  }

  const firstDoneIndex = tasks.findIndex((item) => item.done);
  tasks.splice(firstDoneIndex === -1 ? tasks.length : firstDoneIndex, 0, task);

  activeSet.tasks[listType] = orderTasksForList(listType, tasks);
}

function removeExitedTaskItem(listType, itemEl) {
  if (!itemEl.isConnected) {
    return;
  }

  itemEl.remove();
  els.lists[listType].empty.style.display = els.lists[listType].list.querySelector(".task-item") ? "none" : "block";
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

function runRecurringCompleteAnimation(itemEl, onDone) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !els.recurringPanelToggle) {
    onDone();
    return;
  }

  let finished = false;
  const sourceRect = itemEl.getBoundingClientRect();
  const targetRect = els.recurringPanelToggle.getBoundingClientRect();
  const sourceCenterX = sourceRect.left + sourceRect.width / 2;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const flyer = itemEl.cloneNode(true);
  const itemStyles = window.getComputedStyle(itemEl);

  const finish = () => {
    if (finished) {
      return;
    }

    finished = true;
    flyer.remove();
    els.recurringPanelToggle.classList.remove("recurring-catch-pulse");
    onDone();
  };

  itemEl.classList.add("recurring-complete-origin");
  itemEl.style.setProperty("--task-exit-height", `${sourceRect.height}px`);
  itemEl.style.setProperty("--task-exit-margin-bottom", itemStyles.marginBottom);
  flyer.classList.add("recurring-complete-flyer");
  flyer.style.left = `${sourceRect.left}px`;
  flyer.style.top = `${sourceRect.top}px`;
  flyer.style.width = `${sourceRect.width}px`;
  flyer.style.minHeight = `${sourceRect.height}px`;
  flyer.style.setProperty("--recurring-complete-x", `${targetCenterX - sourceCenterX}px`);
  flyer.style.setProperty("--recurring-complete-y", `${targetCenterY - sourceCenterY}px`);

  els.recurringPanelToggle.classList.remove("recurring-catch-pulse");
  void els.recurringPanelToggle.offsetWidth;
  els.recurringPanelToggle.classList.add("recurring-catch-pulse");
  document.body.appendChild(flyer);

  flyer.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, 500);
}

function runTaskEditAnimation(itemEl, listType, task, onDone) {
  const targetInput = getTaskInput(listType);
  const sourceCopy = itemEl.querySelector(".task-copy");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !targetInput || !sourceCopy) {
    prepareTaskEditMode(listType, task);
    renderAll();
    onDone();
    return;
  }

  let finished = false;
  const sourceRect = itemEl.getBoundingClientRect();
  const inputStartRect = targetInput.getBoundingClientRect();
  const sourceCopyRect = sourceCopy.getBoundingClientRect();
  const itemStyles = window.getComputedStyle(itemEl);
  const copyStyles = window.getComputedStyle(sourceCopy);
  const formEl = els.lists[listType].form;

  formEl.classList.add("edit-morphing");
  revealTaskEditCancelButtonForAnimation(listType);
  prepareTaskEditMode(listType, task);
  targetInput.classList.add("edit-morph-target");

  const cancelButton = getTaskEditCancelButton(listType);
  const cancelMeasurement = expandEditCancelButtonForMeasurement(cancelButton);
  const cancelFinalWidth = cancelMeasurement.width;
  const finalTargetRect = targetInput.getBoundingClientRect();
  cancelMeasurement.restore();
  const cleanupFormAnimation = animateTaskFormControlsForEdit(
    listType,
    inputStartRect.width,
    finalTargetRect.width,
    cancelFinalWidth
  );

  const inputStyles = window.getComputedStyle(targetInput);
  const sourceLineHeight = getComputedLineHeight(copyStyles);
  const inputBorderLeft = parseCssPixelValue(inputStyles.borderLeftWidth);
  const inputBorderRight = parseCssPixelValue(inputStyles.borderRightWidth);
  const inputBorderTop = parseCssPixelValue(inputStyles.borderTopWidth);
  const inputBorderBottom = parseCssPixelValue(inputStyles.borderBottomWidth);
  const inputPaddingLeft = parseCssPixelValue(inputStyles.paddingLeft);
  const inputPaddingRight = parseCssPixelValue(inputStyles.paddingRight);
  const inputPaddingTop = parseCssPixelValue(inputStyles.paddingTop);
  const inputPaddingBottom = parseCssPixelValue(inputStyles.paddingBottom);
  const inputLineHeight = getComputedLineHeight(inputStyles);
  const inputContentHeight = Math.max(
    0,
    finalTargetRect.height - inputBorderTop - inputBorderBottom - inputPaddingTop - inputPaddingBottom
  );
  const targetTextLeft = inputBorderLeft + inputPaddingLeft;
  const targetTextTop = inputBorderTop + inputPaddingTop + Math.max(0, (inputContentHeight - inputLineHeight) / 2);
  const targetTextWidth = Math.max(
    0,
    finalTargetRect.width - inputBorderLeft - inputBorderRight - inputPaddingLeft - inputPaddingRight
  );
  const flyer = document.createElement("div");
  const flyerCopy = document.createElement("span");

  flyer.className = "task-edit-flyer";
  flyer.setAttribute("aria-hidden", "true");
  flyerCopy.className = "task-edit-flyer-copy";
  flyerCopy.textContent = sourceCopy.textContent;
  flyer.appendChild(flyerCopy);

  Object.assign(flyer.style, {
    left: `${sourceRect.left}px`,
    top: `${sourceRect.top}px`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
    backgroundColor: itemStyles.backgroundColor,
    borderColor: itemStyles.borderColor,
    borderRadius: itemStyles.borderRadius,
    borderWidth: itemStyles.borderWidth,
    boxShadow: itemStyles.boxShadow,
  });

  Object.assign(flyerCopy.style, {
    left: `${sourceCopyRect.left - sourceRect.left}px`,
    top: `${sourceCopyRect.top - sourceRect.top}px`,
    width: `${sourceCopyRect.width}px`,
    height: `${sourceCopyRect.height}px`,
    color: copyStyles.color,
    fontFamily: copyStyles.fontFamily,
    fontSize: copyStyles.fontSize,
    fontWeight: copyStyles.fontWeight,
    lineHeight: `${sourceLineHeight}px`,
  });

  const finish = () => {
    if (finished) {
      return;
    }

    finished = true;
    onDone();
    window.requestAnimationFrame(() => {
      cleanupFormAnimation();
      formEl.classList.remove("edit-morphing");
      targetInput.classList.remove("edit-morph-target");
      itemEl.classList.remove("edit-origin");
      flyer.remove();
    });
  };

  document.body.appendChild(flyer);
  itemEl.classList.add("edit-origin", "editing");

  if (typeof flyer.animate !== "function") {
    finish();
    return;
  }

  const timing = {
    duration: EDIT_TASK_MOTION_MS,
    easing: "cubic-bezier(0.22, 0.72, 0.2, 1)",
    fill: "forwards",
  };
  const shellAnimation = flyer.animate(
    [
      {
        left: `${sourceRect.left}px`,
        top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        backgroundColor: itemStyles.backgroundColor,
        borderColor: itemStyles.borderColor,
        borderRadius: itemStyles.borderRadius,
        borderWidth: itemStyles.borderWidth,
        boxShadow: itemStyles.boxShadow,
      },
      {
        left: `${finalTargetRect.left}px`,
        top: `${finalTargetRect.top}px`,
        width: `${finalTargetRect.width}px`,
        height: `${finalTargetRect.height}px`,
        backgroundColor: inputStyles.backgroundColor,
        borderColor: inputStyles.borderColor,
        borderRadius: inputStyles.borderRadius,
        borderWidth: inputStyles.borderWidth,
        boxShadow: inputStyles.boxShadow,
      },
    ],
    timing
  );

  flyerCopy.animate(
    [
      {
        left: `${sourceCopyRect.left - sourceRect.left}px`,
        top: `${sourceCopyRect.top - sourceRect.top}px`,
        width: `${sourceCopyRect.width}px`,
        height: `${sourceCopyRect.height}px`,
        color: copyStyles.color,
        fontSize: copyStyles.fontSize,
        lineHeight: `${sourceLineHeight}px`,
      },
      {
        left: `${targetTextLeft}px`,
        top: `${targetTextTop}px`,
        width: `${targetTextWidth}px`,
        height: `${inputLineHeight}px`,
        color: inputStyles.color,
        fontSize: inputStyles.fontSize,
        lineHeight: `${inputLineHeight}px`,
      },
    ],
    timing
  );

  if (typeof shellAnimation.addEventListener === "function") {
    shellAnimation.addEventListener("finish", finish, { once: true });
  } else {
    shellAnimation.onfinish = finish;
  }

  window.setTimeout(finish, EDIT_TASK_MOTION_MS + 120);
}

function revealTaskEditCancelButtonForAnimation(listType) {
  const cancelButton = getTaskEditCancelButton(listType);

  cancelButton.hidden = false;
  cancelButton.disabled = true;
  cancelButton.setAttribute("aria-hidden", "true");
  cancelButton.tabIndex = -1;
  void cancelButton.offsetWidth;
}

function expandEditCancelButtonForMeasurement(cancelButton) {
  const previousTransition = cancelButton.style.transition;
  const previousFlexBasis = cancelButton.style.flexBasis;
  const previousWidth = cancelButton.style.width;
  const previousBorderWidth = cancelButton.style.borderWidth;
  const previousOpacity = cancelButton.style.opacity;
  const previousTransform = cancelButton.style.transform;

  cancelButton.style.transition = "none";
  cancelButton.style.flexBasis = "2.7rem";
  cancelButton.style.width = "2.7rem";
  cancelButton.style.borderWidth = "1px";
  cancelButton.style.opacity = "1";
  cancelButton.style.transform = "scale(1)";

  const width = cancelButton.getBoundingClientRect().width;

  return {
    width,
    restore() {
      cancelButton.style.transition = previousTransition;
      cancelButton.style.flexBasis = previousFlexBasis;
      cancelButton.style.width = previousWidth;
      cancelButton.style.borderWidth = previousBorderWidth;
      cancelButton.style.opacity = previousOpacity;
      cancelButton.style.transform = previousTransform;
    },
  };
}

function animateTaskFormControlsForEdit(listType, startInputWidth, endInputWidth, endCancelWidth) {
  const form = els.lists[listType].form;
  const input = getTaskInput(listType);
  const cancelButton = getTaskEditCancelButton(listType);
  const previousFlex = input.style.flex;
  const previousFlexBasis = input.style.flexBasis;
  const previousWidth = input.style.width;
  const previousMaxWidth = input.style.maxWidth;
  const previousTransition = input.style.transition;
  const previousCancelFlexBasis = cancelButton.style.flexBasis;
  const previousCancelWidth = cancelButton.style.width;
  const previousCancelBorderWidth = cancelButton.style.borderWidth;
  const previousCancelOpacity = cancelButton.style.opacity;
  const previousCancelTransform = cancelButton.style.transform;
  const previousCancelTransition = cancelButton.style.transition;
  const easing = "cubic-bezier(0.22, 0.72, 0.2, 1)";
  const inputTiming = `flex-basis ${EDIT_TASK_MOTION_MS}ms ${easing}, width ${EDIT_TASK_MOTION_MS}ms ${easing}, max-width ${EDIT_TASK_MOTION_MS}ms ${easing}`;
  const cancelTiming = `flex-basis ${EDIT_TASK_MOTION_MS}ms ${easing}, width ${EDIT_TASK_MOTION_MS}ms ${easing}, opacity 180ms ease, transform ${EDIT_TASK_MOTION_MS}ms ${easing}, border-width ${EDIT_TASK_MOTION_MS}ms ${easing}`;

  input.style.transition = "none";
  input.style.flex = `0 0 ${startInputWidth}px`;
  input.style.width = `${startInputWidth}px`;
  input.style.maxWidth = `${startInputWidth}px`;
  cancelButton.style.transition = "none";
  cancelButton.style.flexBasis = "0px";
  cancelButton.style.width = "0px";
  cancelButton.style.borderWidth = "0";
  cancelButton.style.opacity = "0";
  cancelButton.style.transform = "scale(0.84)";
  void form.offsetWidth;

  window.requestAnimationFrame(() => {
    input.style.transition = inputTiming;
    input.style.flexBasis = `${endInputWidth}px`;
    input.style.width = `${endInputWidth}px`;
    input.style.maxWidth = `${endInputWidth}px`;
    cancelButton.style.transition = cancelTiming;
    cancelButton.style.flexBasis = `${endCancelWidth}px`;
    cancelButton.style.width = `${endCancelWidth}px`;
    cancelButton.style.borderWidth = "1px";
    cancelButton.style.opacity = "1";
    cancelButton.style.transform = "scale(1)";
  });

  return () => {
    input.style.flex = previousFlex;
    input.style.flexBasis = previousFlexBasis;
    input.style.width = previousWidth;
    input.style.maxWidth = previousMaxWidth;
    input.style.transition = previousTransition;
    cancelButton.style.flexBasis = previousCancelFlexBasis;
    cancelButton.style.width = previousCancelWidth;
    cancelButton.style.borderWidth = previousCancelBorderWidth;
    cancelButton.style.opacity = previousCancelOpacity;
    cancelButton.style.transform = previousCancelTransform;
    cancelButton.style.transition = previousCancelTransition;
  };
}

function parseCssPixelValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getComputedLineHeight(styles) {
  const lineHeight = parseCssPixelValue(styles.lineHeight);

  if (lineHeight > 0) {
    return lineHeight;
  }

  return parseCssPixelValue(styles.fontSize) * 1.2;
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

  const itemStyles = window.getComputedStyle(itemEl);
  itemEl.style.setProperty("--task-exit-height", `${itemEl.getBoundingClientRect().height}px`);
  itemEl.style.setProperty("--task-exit-margin-bottom", itemStyles.marginBottom);
  itemEl.classList.add(animationClass, "is-exiting");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }

  itemEl.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, 240);
}

function handleListDragOver(event, listType) {
  if (dragState.listType !== listType || !dragState.taskId) {
    return;
  }

  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  const insertIndex = clampDropInsertIndex(listType, getDropInsertIndex(listType, event.clientY));
  dragState.insertIndex = insertIndex;
  renderDropIndicator(listType, insertIndex);
  updateDragAutoScroll(listType, event.clientY);
}

function handleListDrop(event, listType) {
  if (dragState.listType !== listType || !dragState.taskId) {
    return;
  }

  event.preventDefault();
  stopDragAutoScroll();

  const insertIndex =
    dragState.insertIndex === null
      ? clampDropInsertIndex(listType, getDropInsertIndex(listType, event.clientY))
      : dragState.insertIndex;
  const beforePositions = captureTaskPositions(listType);

  reorderTaskToVisibleIndex(listType, dragState.taskId, insertIndex);
  clearDropIndicator();
  saveState();
  renderAll();
  animateListReflow(listType, beforePositions);
  cleanupDragState();
}

function isPointInsideElement(clientX, clientY, element) {
  const rect = element.getBoundingClientRect();

  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function getDropInsertIndex(listType, clientY) {
  const listEl = els.lists[listType].list;
  const taskItems = [...listEl.querySelectorAll(".task-item:not(.dragging)")];

  if (taskItems.length === 0) {
    return 0;
  }

  const listRect = listEl.getBoundingClientRect();

  if (clientY <= listRect.top) {
    return 0;
  }

  if (clientY >= listRect.bottom) {
    return taskItems.length;
  }

  const targetIndex = taskItems.findIndex((itemEl) => {
    const rect = itemEl.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });

  return targetIndex === -1 ? taskItems.length : targetIndex;
}

function clampDropInsertIndex(listType, insertIndex) {
  if (!usesRecurringTaskGrouping(listType) || !dragState.taskId) {
    return insertIndex;
  }

  const draggedTask = getActiveListSet().tasks[listType].find((task) => task.id === dragState.taskId);

  if (!draggedTask) {
    return insertIndex;
  }

  const groupRange = getVisibleTaskGroupRange(listType, getRjTaskGroup(draggedTask));

  return Math.max(groupRange.start, Math.min(insertIndex, groupRange.end));
}

function getVisibleTaskGroupRange(listType, targetGroup) {
  const taskItems = [...els.lists[listType].list.querySelectorAll(".task-item:not(.dragging)")];
  let start = 0;

  for (const group of RJ_TASK_GROUPS) {
    const groupSize = taskItems.filter((itemEl) => itemEl.dataset.taskGroup === group).length;

    if (group === targetGroup) {
      return {
        start,
        end: start + groupSize,
      };
    }

    start += groupSize;
  }

  return {
    start: taskItems.length,
    end: taskItems.length,
  };
}

function updateDragAutoScroll(listType, clientY) {
  const speed = getDragAutoScrollSpeed(listType, clientY);

  dragAutoScrollState.listType = listType;
  dragAutoScrollState.lastClientY = clientY;
  dragAutoScrollState.speed = speed;

  if (speed === 0) {
    stopDragAutoScroll();
    return;
  }

  if (dragAutoScrollState.frameId === null) {
    dragAutoScrollState.frameId = window.requestAnimationFrame(runDragAutoScroll);
  }
}

function getDragAutoScrollSpeed(listType, clientY) {
  const { card, list } = els.lists[listType];

  if (list.scrollHeight <= list.clientHeight) {
    return 0;
  }

  const cardRect = card.getBoundingClientRect();

  if (clientY < cardRect.top || clientY > cardRect.bottom) {
    return 0;
  }

  const listRect = list.getBoundingClientRect();
  const edgeSize = Math.min(64, Math.max(32, listRect.height * 0.22));
  const canScrollUp = list.scrollTop > 0;
  const canScrollDown = list.scrollTop + list.clientHeight < list.scrollHeight - 1;

  if (clientY <= listRect.top + edgeSize && canScrollUp) {
    const intensity = Math.min(1, (listRect.top + edgeSize - clientY) / edgeSize);
    return -Math.ceil(4 + intensity * 14);
  }

  if (clientY >= listRect.bottom - edgeSize && canScrollDown) {
    const intensity = Math.min(1, (clientY - (listRect.bottom - edgeSize)) / edgeSize);
    return Math.ceil(4 + intensity * 14);
  }

  return 0;
}

function runDragAutoScroll() {
  dragAutoScrollState.frameId = null;

  const { listType, lastClientY, speed } = dragAutoScrollState;

  if (!listType || lastClientY === null || speed === 0 || dragState.listType !== listType || !dragState.taskId) {
    stopDragAutoScroll();
    return;
  }

  const listEl = els.lists[listType].list;
  const previousScrollTop = listEl.scrollTop;
  listEl.scrollTop += speed;

  if (listEl.scrollTop !== previousScrollTop) {
    const insertIndex = clampDropInsertIndex(listType, getDropInsertIndex(listType, lastClientY));
    dragState.insertIndex = insertIndex;
    renderDropIndicator(listType, insertIndex);
  }

  const nextSpeed = getDragAutoScrollSpeed(listType, lastClientY);
  dragAutoScrollState.speed = nextSpeed;

  if (nextSpeed !== 0) {
    dragAutoScrollState.frameId = window.requestAnimationFrame(runDragAutoScroll);
  } else {
    stopDragAutoScroll();
  }
}

function stopDragAutoScroll() {
  if (dragAutoScrollState.frameId !== null) {
    window.cancelAnimationFrame(dragAutoScrollState.frameId);
  }

  dragAutoScrollState = {
    listType: null,
    frameId: null,
    lastClientY: null,
    speed: 0,
  };
}

function renderDropIndicator(listType, insertIndex) {
  const listEl = els.lists[listType].list;
  const taskItems = [...listEl.querySelectorAll(".task-item:not(.dragging)")];
  const upperTask = taskItems[insertIndex - 1];
  const lowerTask = taskItems[insertIndex];

  clearDropIndicatorClasses();

  listEl.classList.add("drag-active");
  listEl.classList.toggle("drop-at-start", insertIndex === 0);

  if (upperTask) {
    upperTask.classList.add("drop-after");
  }

  if (lowerTask && insertIndex !== 0) {
    lowerTask.classList.add("drop-before");
  }
}

function clearDropIndicator() {
  clearDropIndicatorClasses();
  stopDragAutoScroll();
  dragState.insertIndex = null;
}

function clearDropIndicatorClasses() {
  document.querySelectorAll(".task-item.drop-before, .task-item.drop-after").forEach((itemEl) => {
    itemEl.classList.remove("drop-before", "drop-after");
  });

  document.querySelectorAll(".task-list.drop-at-start").forEach((listEl) => {
    listEl.classList.remove("drop-at-start");
  });
}

function cleanupDragState() {
  clearDropIndicator();
  Object.values(els.lists).forEach(({ list }) => list.classList.remove("drag-active"));
  dragState = { listType: null, taskId: null, insertIndex: null };
}

function reorderTaskToVisibleIndex(listType, dragId, insertIndex) {
  const activeSet = getActiveListSet();
  const orderedTasks = orderTasksForList(listType, activeSet.tasks[listType]);
  const draggedTask = orderedTasks.find((task) => task.id === dragId);

  if (!draggedTask) {
    return;
  }

  if (usesRecurringTaskGrouping(listType)) {
    reorderRecurringAwareTask(listType, dragId, insertIndex, orderedTasks, draggedTask);
    return;
  }

  const unfinishedTasks = orderedTasks.filter((task) => !task.done);
  const finishedTasks = orderedTasks.filter((task) => task.done);
  const groupTasks = draggedTask.done ? finishedTasks : unfinishedTasks;
  const fromIndex = groupTasks.findIndex((task) => task.id === dragId);

  if (fromIndex < 0) {
    return;
  }

  const [moved] = groupTasks.splice(fromIndex, 1);
  const unfinishedCount = draggedTask.done ? unfinishedTasks.length : 0;
  const groupInsertIndex = insertIndex - unfinishedCount;
  const boundedIndex = Math.max(0, Math.min(groupInsertIndex, groupTasks.length));

  groupTasks.splice(boundedIndex, 0, moved);

  activeSet.tasks[listType] = draggedTask.done
    ? [...unfinishedTasks, ...groupTasks]
    : [...groupTasks, ...finishedTasks];
}

function reorderRecurringAwareTask(listType, dragId, insertIndex, orderedTasks, draggedTask) {
  const activeSet = getActiveListSet();
  const draggedGroup = getRjTaskGroup(draggedTask);
  const visibleOrderedTasks = getVisibleTasksForList(listType, orderedTasks);
  const groups = Object.fromEntries(
    RJ_TASK_GROUPS.map((group) => [group, orderedTasks.filter((task) => getRjTaskGroup(task) === group)])
  );
  const groupTasks = groups[draggedGroup];
  const visibleGroupTasks = groupTasks.filter((task) => isTaskVisibleInList(listType, task));
  const reorderedVisibleTasks = visibleGroupTasks.filter((task) => task.id !== dragId);
  const groupStartIndex = RJ_TASK_GROUPS.slice(0, RJ_TASK_GROUPS.indexOf(draggedGroup)).reduce(
    (count, group) => count + visibleOrderedTasks.filter((task) => getRjTaskGroup(task) === group).length,
    0
  );
  const groupInsertIndex = insertIndex - groupStartIndex;
  const boundedIndex = Math.max(0, Math.min(groupInsertIndex, reorderedVisibleTasks.length));

  reorderedVisibleTasks.splice(boundedIndex, 0, draggedTask);
  groups[draggedGroup] = mergeVisibleTaskOrder(groupTasks, reorderedVisibleTasks, listType);

  activeSet.tasks[listType] = RJ_TASK_GROUPS.flatMap((group) => groups[group]);
}

function mergeVisibleTaskOrder(groupTasks, reorderedVisibleTasks, listType) {
  let visibleIndex = 0;

  return groupTasks.map((task) => {
    if (!isTaskVisibleInList(listType, task)) {
      return task;
    }

    const replacement = reorderedVisibleTasks[visibleIndex];
    visibleIndex += 1;
    return replacement || task;
  });
}

function hydrateSettingsUI() {
  els.timezoneOffset.value = state.settings.timezoneOffset;
  els.dstAdjustment.checked = state.settings.daylightSavingsAdjustment === 1;
}

function runTimedUpdatesIfNeeded() {
  const didReset = runResetsIfNeeded();
  const didRefreshRecurring = refreshRecurringTasksIfNeeded();

  return didReset || didRefreshRecurring;
}

function refreshRecurringTasksIfNeeded() {
  const todayId = dailyPeriodId(new Date());
  let didRefresh = false;

  state.listSets.rj.tasks.persistent = state.listSets.rj.tasks.persistent.map((task) => {
    if (!isRecurringTask(task)) {
      return task;
    }

    if (task.nextDueDate && task.nextDueDate > todayId) {
      return task;
    }

    didRefresh = true;

    return {
      ...task,
      done: false,
      recurringStartDate: todayId,
      lastCompletedDate: "",
      nextDueDate: addDaysToDateId(todayId, task.intervalDays),
    };
  });

  if (didRefresh) {
    state.listSets.rj.tasks.persistent = orderRjPersistentTasks(state.listSets.rj.tasks.persistent);
    saveState();
  }

  return didRefresh;
}

function runResetsIfNeeded() {
  const now = new Date();
  const nextDailyPeriodId = schedmsDailyPeriodId(now);
  const nextWeeklyPeriodId = schedmsWeeklyPeriodId(now);
  const listSet = state.listSets.schedms;
  let didReset = false;

  if (listSet.periodIds.daily !== nextDailyPeriodId) {
    listSet.periodIds.daily = nextDailyPeriodId;
    listSet.tasks.daily = listSet.tasks.daily.map((task) => ({ ...task, done: false }));
    didReset = true;
  }

  if (listSet.periodIds.weekly !== nextWeeklyPeriodId) {
    listSet.periodIds.weekly = nextWeeklyPeriodId;
    listSet.tasks.weekly = listSet.tasks.weekly.map((task) => ({ ...task, done: false }));
    didReset = true;
  }

  if (didReset) {
    saveState();
  }

  return didReset;
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

function normalizeRecurringIntervalDays(value) {
  const intervalDays = Number(value);

  if (intervalDays === MAX_RECURRING_INTERVAL_DAYS) {
    return MAX_RECURRING_INTERVAL_DAYS;
  }

  return MIN_RECURRING_INTERVAL_DAYS;
}

function normalizeRecurringShowDays(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const showDays = [...new Set(value.map(Number).filter((dayIndex) => Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex <= 6))];

  if (showDays.length === 0 || showDays.length === DAY_NAMES.length) {
    return [];
  }

  return showDays.sort((a, b) => a - b);
}

function getEffectiveRecurringShowDays(task) {
  return normalizeRecurringIntervalDays(task?.intervalDays) === MAX_RECURRING_INTERVAL_DAYS
    ? normalizeRecurringShowDays(task?.showDays)
    : [];
}

function normalizeDateId(value) {
  const dateId = String(value || "");

  return /^\d{4}-\d{2}-\d{2}$/.test(dateId) ? dateId : "";
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

function currentPlannerDate(date = new Date()) {
  return toTimezoneDate(
    date,
    state.settings.timezoneOffset,
    state.settings.daylightSavingsAdjustment
  );
}

function formatDateParts(dateObj) {
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysToDateId(dateId, dayCount) {
  const [year, month, day] = normalizeDateId(dateId).split("-").map(Number);

  if (!year || !month || !day) {
    return dailyPeriodId(new Date());
  }

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  dateObj.setUTCDate(dateObj.getUTCDate() + normalizeRecurringIntervalDays(dayCount));

  return formatDateParts(dateObj);
}

function dateIdToUtcTime(dateId) {
  const [year, month, day] = normalizeDateId(dateId).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function getDaysUntilDate(dateId) {
  const targetTime = dateIdToUtcTime(dateId);
  const todayTime = dateIdToUtcTime(dailyPeriodId(new Date()));

  if (targetTime === null || todayTime === null) {
    return 1;
  }

  return Math.max(1, Math.ceil((targetTime - todayTime) / 86400000));
}

function currentPlannerDayIndex(date = new Date()) {
  return currentPlannerDate(date).getUTCDay();
}

function doesRecurringTaskShowToday(task, date = new Date()) {
  const showDays = getEffectiveRecurringShowDays(task);

  return showDays.length === 0 || showDays.includes(currentPlannerDayIndex(date));
}

function formatRecurringDaysLeft(task) {
  if (getEffectiveRecurringShowDays(task).length === 0) {
    return "";
  }

  const nextDueDate =
    normalizeDateId(task.nextDueDate) ||
    addDaysToDateId(normalizeDateId(task.recurringStartDate) || dailyPeriodId(new Date()), task.intervalDays);
  const daysLeft = getDaysUntilDate(nextDueDate);

  return daysLeft === 1 ? "final day" : `${daysLeft} days left`;
}

function formatRecurringListBadge(task) {
  const showDays = getEffectiveRecurringShowDays(task);

  return showDays.length > 0 ? formatRecurringShowDays(task) : formatRecurringIntervalLabel(task.intervalDays);
}

function formatRecurringIntervalLabel(intervalDays) {
  const normalizedInterval = normalizeRecurringIntervalDays(intervalDays);

  if (normalizedInterval === 1) {
    return "Everyday";
  }

  if (normalizedInterval === 7) {
    return "Weekly";
  }

  return "Everyday";
}

function formatRecurringShowDays(task) {
  const showDays = getEffectiveRecurringShowDays(task);

  if (showDays.length === 0) {
    return "Any day";
  }

  return showDays.map((dayIndex) => DAY_SHORT_NAMES[dayIndex]).join(", ");
}

function formatRecurringPanelMeta(task) {
  const showDays = getEffectiveRecurringShowDays(task);
  const metaParts = [];

  if (showDays.length > 0) {
    metaParts.push(formatRecurringShowDays(task));
  }

  metaParts.push(formatRecurringIntervalLabel(task.intervalDays));

  if (!shouldShowRecurringPanelStatusBadge(task)) {
    metaParts.push(formatNextRecurringShowLabel(task));
  }

  return metaParts.join(" | ");
}

function shouldShowRecurringPanelStatusBadge(task) {
  return task.done || doesRecurringTaskShowToday(task);
}

function formatRecurringPanelStatus(task) {
  if (task.done) {
    return "Done";
  }

  if (doesRecurringTaskShowToday(task)) {
    return "On list";
  }

  return formatNextRecurringShowLabel(task);
}

function formatNextRecurringShowLabel(task) {
  const showDays = getEffectiveRecurringShowDays(task);

  if (showDays.length === 0) {
    return "Any day";
  }

  const todayIndex = currentPlannerDayIndex();
  const nextShow = showDays.reduce(
    (best, dayIndex) => {
      const offsetDays = (dayIndex - todayIndex + DAY_NAMES.length) % DAY_NAMES.length;

      return offsetDays < best.offsetDays ? { dayIndex, offsetDays } : best;
    },
    { dayIndex: showDays[0], offsetDays: DAY_NAMES.length }
  );

  if (nextShow.offsetDays === 0) {
    return "Today";
  }

  if (nextShow.offsetDays === 1) {
    return "Tomorrow";
  }

  return `Next ${DAY_SHORT_NAMES[nextShow.dayIndex]}`;
}

function dailyPeriodId(now) {
  return formatDateParts(currentPlannerDate(now));
}

function schedmsDailyPeriodId(now) {
  return formatDateParts(now);
}

function schedmsWeeklyPeriodId(now) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffDays = (now.getUTCDay() - SCHEDMS_WEEKLY_RESET_DAY_UTC + DAY_NAMES.length) % DAY_NAMES.length;
  periodStart.setUTCDate(periodStart.getUTCDate() - diffDays);
  return formatDateParts(periodStart);
}

function nextUtcDailyResetDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function nextUtcWeeklyResetDate(now = new Date()) {
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilReset = (SCHEDMS_WEEKLY_RESET_DAY_UTC - now.getUTCDay() + DAY_NAMES.length) % DAY_NAMES.length;
  nextReset.setUTCDate(nextReset.getUTCDate() + daysUntilReset);

  if (nextReset <= now) {
    nextReset.setUTCDate(nextReset.getUTCDate() + DAY_NAMES.length);
  }

  return nextReset;
}

function currentResetDisplayDate(date = new Date()) {
  return toTimezoneDate(
    date,
    state.settings.timezoneOffset,
    state.settings.daylightSavingsAdjustment
  );
}

function renderResetLabels() {
  const dailyReset = currentResetDisplayDate(nextUtcDailyResetDate());
  const weeklyReset = currentResetDisplayDate(nextUtcWeeklyResetDate());

  els.dailyResetLabel.textContent = `Reset: ${formatPlannerDate(dailyReset, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
  els.weeklyResetLabel.textContent = `Reset: ${formatPlannerDate(weeklyReset, {
    weekday: "short",
    month: "long",
    day: "numeric",
  })}`;
}

function formatPlannerDate(dateObj, options) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(dateObj);
}

function normalizeTaskSet(taskSet) {
  if (!Array.isArray(taskSet)) {
    return [];
  }

  return taskSet
    .map((task) => {
      const recurring = task?.recurring === true;
      const normalizedTask = {
        id: String(task?.id || crypto.randomUUID()),
        text: String(task?.text || "").trim().slice(0, MAX_TASK_TEXT_LENGTH),
        done: Boolean(task?.done),
      };

      if (recurring) {
        normalizedTask.recurring = true;
        normalizedTask.intervalDays = normalizeRecurringIntervalDays(task?.intervalDays);
        normalizedTask.showDays = normalizeRecurringShowDays(task?.showDays);
        normalizedTask.recurringStartDate = normalizeDateId(task?.recurringStartDate);
        normalizedTask.lastCompletedDate = normalizeDateId(task?.lastCompletedDate);
        normalizedTask.lastRestoredDate = normalizeDateId(task?.lastRestoredDate);
        normalizedTask.nextDueDate = normalizeDateId(task?.nextDueDate);
      }

      return normalizedTask;
    })
    .filter((task) => task.text.length > 0);
}

function normalizeListSetState(listSet) {
  const defaults = createDefaultListSetState();

  return {
    periodIds: {
      daily: String(listSet?.periodIds?.daily || defaults.periodIds.daily),
      weekly: String(listSet?.periodIds?.weekly || defaults.periodIds.weekly),
    },
    tasks: {
      daily: normalizeTaskSet(listSet?.tasks?.daily),
      weekly: normalizeTaskSet(listSet?.tasks?.weekly),
      persistent: normalizeTaskSet(listSet?.tasks?.persistent ?? listSet?.tasks?.todo),
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return structuredClone(defaultState);
    }

    const parsed = JSON.parse(raw);

    const legacyListSet = {
      periodIds: parsed?.periodIds,
      tasks: parsed?.tasks,
    };
    const listSets = Object.fromEntries(
      LIST_SET_IDS.map((listSetId) => [
        listSetId,
        normalizeListSetState(
          parsed?.listSets?.[listSetId] ?? (listSetId === DEFAULT_LIST_SET_ID ? legacyListSet : undefined)
        ),
      ])
    );

    return {
      settings: {
        timezoneOffset: normalizeTimezoneOffset(parsed?.settings?.timezoneOffset),
        daylightSavingsAdjustment: normalizeDstAdjustment(parsed?.settings?.daylightSavingsAdjustment),
      },
      activeListSet: normalizeListSetId(parsed?.activeListSet),
      listSets,
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
