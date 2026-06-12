const STORAGE_KEY = "schedms-data-v1";
const SUPABASE_URL = "https://qvovatdgthvolgenmnir.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1Kp-mcwQyvdH6P_VEiyqFA_gFtRsAu3";
const SUPABASE_CLIENT_MODULE_URL = "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_CLIENT_FALLBACK_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SUPABASE_STATE_TABLE = "planner_states";
const SUPABASE_PROFILE_TABLE = "planner_profiles";
const SUPABASE_PAIRING_TABLE = "planner_pairings";
const AUTH_MIGRATION_KEY = `${STORAGE_KEY}-auth-migrated-user`;
const LIST_TYPES = ["daily", "weekly", "persistent"];
const RJ_LIST_TYPES = ["persistent"];
const LIST_SET_IDS = ["schedms", "rj"];
const DEFAULT_LIST_SET_ID = "schedms";
const INITIAL_LIST_SET_ID = "rj";
const MIN_RECURRING_INTERVAL_DAYS = 1;
const MAX_RECURRING_INTERVAL_DAYS = 7;
const MAX_TASK_TEXT_LENGTH = 100;
const MAX_PAIRED_DISPLAY_NAME_LENGTH = 15;
const RJ_TASK_GROUPS = ["recurring-open", "one-time-open", "done"];
const RJ_TASK_OPTION_ONE_TIME = "one-time";
const RJ_TASK_OPTION_DAILY = "daily";
const RJ_TASK_OPTION_WEEKLY = "weekly";
const LIST_SET_LABELS = {
  schedms: "MS",
  rj: "IRL",
};
const LIST_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  persistent: "To-Do",
};
const ADD_TASK_SYMBOL = "";
const SAVE_TASK_SYMBOL = "✓";
const DEFAULT_TIMEZONE_OFFSET = "-08:00";
const SCHEDMS_WEEKLY_RESET_DAY_UTC = 4;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RECURRING_PANEL_MOTION_MS = 180;
const RECURRING_PANEL_CLOSE_DELAY_MS = 180;
const RECURRING_FORM_MOTION_MS = 260;
const CUSTOM_SELECT_CLOSE_MS = 120;
const EDIT_TASK_MOTION_MS = 420;
const EDIT_CANCEL_MOTION_MS = 220;
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
    pairedAccountDisplayName: "",
  },
  lastSavedAt: "",
  activeListSet: INITIAL_LIST_SET_ID,
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
      persistent: "",
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

function getVisibleListSetId() {
  return normalizeListSetId(state?.activeListSet || INITIAL_LIST_SET_ID);
}

function setPlannerStateListSet(plannerState, listSetId) {
  if (plannerState) {
    plannerState.activeListSet = normalizeListSetId(listSetId);
  }

  return plannerState;
}

function showInitialListSet() {
  setPlannerStateListSet(state, INITIAL_LIST_SET_ID);
}

function isReadOnlyView() {
  return plannerViewMode === "partner";
}

function getAcceptedPairing() {
  return pairingContext.accepted;
}

let activeStorageKey = STORAGE_KEY;
let state = loadState();
let didBackfillCompletionOrders = backfillCompletionOrders(state);
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
let recurringPanelHoverCloseTimer = null;
let recurringCreateMode = false;
let recurringFormCloseTimer = null;
let completionAudioContext = null;
let openCustomSelect = null;
let supabaseClient = null;
let supabaseUserId = "";
let supabaseSyncReady = false;
let supabaseSyncPending = false;
let supabaseSyncInFlight = false;
let supabaseSyncStatus = "local";
let supabaseSyncErrorMessage = "";
let signedInUserEmail = "";
let authMode = "sign-in";
let pendingLegacyMigrationUserId = "";
let selfState = state;
let partnerState = null;
let plannerViewMode = "self";
let pairingContext = {
  accepted: null,
  incoming: null,
  outgoing: null,
  profiles: {},
};
let pairingRefreshInFlight = false;
const pendingAppendAnimations = new Set();
const editCancelHideTimers = new Map();

const els = {
  app: document.querySelector(".app"),
  appHeader: document.getElementById("app-header"),
  authView: document.getElementById("auth-view"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authConfirmPasswordLabel: document.getElementById("auth-confirm-password-label"),
  authConfirmPassword: document.getElementById("auth-confirm-password"),
  authSubmitBtn: document.getElementById("auth-submit-btn"),
  authSignInMode: document.getElementById("auth-sign-in-mode"),
  authSignUpMode: document.getElementById("auth-sign-up-mode"),
  authMessage: document.getElementById("auth-message"),
  authUserLabel: document.getElementById("auth-user-label"),
  authSignOutBtn: document.getElementById("auth-sign-out-btn"),
  listsView: document.getElementById("lists-view"),
  plannerOwnerSwitcher: document.getElementById("planner-owner-switcher"),
  plannerOwnerButtons: document.querySelectorAll(".planner-owner-switch"),
  partnerOwnerSwitch: document.getElementById("partner-owner-switch"),
  pairingForm: document.getElementById("pairing-form"),
  pairingEmail: document.getElementById("pairing-email"),
  pairingInviteBtn: document.getElementById("pairing-invite-btn"),
  pairingIncoming: document.getElementById("pairing-incoming"),
  pairingIncomingCopy: document.getElementById("pairing-incoming-copy"),
  pairingAcceptBtn: document.getElementById("pairing-accept-btn"),
  pairingDeclineBtn: document.getElementById("pairing-decline-btn"),
  pairingOutgoing: document.getElementById("pairing-outgoing"),
  pairingOutgoingCopy: document.getElementById("pairing-outgoing-copy"),
  pairingCancelBtn: document.getElementById("pairing-cancel-btn"),
  pairingConnected: document.getElementById("pairing-connected"),
  pairingConnectedCopy: document.getElementById("pairing-connected-copy"),
  pairingRemoveBtn: document.getElementById("pairing-remove-btn"),
  pairingMessage: document.getElementById("pairing-message"),
  pairedNameToggleBtn: document.getElementById("paired-name-toggle-btn"),
  pairedNameEditor: document.getElementById("paired-name-editor"),
  pairedDisplayName: document.getElementById("paired-display-name"),
  passwordForm: document.getElementById("password-form"),
  passwordToggleBtn: document.getElementById("password-toggle-btn"),
  passwordFields: document.getElementById("password-fields"),
  newPassword: document.getElementById("new-password"),
  confirmNewPassword: document.getElementById("confirm-new-password"),
  passwordSubmitBtn: document.getElementById("password-submit-btn"),
  passwordCancelBtn: document.getElementById("password-cancel-btn"),
  passwordMessage: document.getElementById("password-message"),
  deleteAccountStartBtn: document.getElementById("delete-account-start-btn"),
  deleteAccountConfirm: document.getElementById("delete-account-confirm"),
  deleteAccountConfirmInput: document.getElementById("delete-account-confirm-input"),
  deleteAccountCancelBtn: document.getElementById("delete-account-cancel-btn"),
  deleteAccountConfirmBtn: document.getElementById("delete-account-confirm-btn"),
  deleteAccountMessage: document.getElementById("delete-account-message"),
  settingsOpenBtn: document.getElementById("settings-open-btn"),
  settingsCloseBtn: document.getElementById("settings-close-btn"),
  settingsModal: document.getElementById("settings-modal"),
  rjProgress: document.querySelector(".rj-progress"),
  rjProgressFill: document.getElementById("rj-progress-fill"),
  rjProgressLabel: document.getElementById("rj-progress-label"),
  schedmsQuickAdd: document.getElementById("schedms-quick-add"),
  schedmsAddForm: document.getElementById("schedms-add-form"),
  schedmsInput: document.getElementById("schedms-input"),
  schedmsTargetList: document.getElementById("schedms-target-list"),
  schedmsAddError: document.getElementById("schedms-add-error"),
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
  showInitialListSet();
  selfState = state;
  populateTimezoneOptions();
  populateRecurringShowDayOptions();
  updateRecurringShowDaysVisibility();
  hydrateSettingsUI();
  const didTimedUpdate = runTimedUpdatesIfNeeded();
  if (didBackfillCompletionOrders && !didTimedUpdate) {
    saveState();
  }
  wireEvents();
  window.setInterval(tickResets, 15000);
  renderAll();
  ensureSaveStatusTimestamp();
  initializeSupabaseSync();
}

function tickResets() {
  if (!isReadOnlyView() && runTimedUpdatesIfNeeded()) {
    renderAll();
  }

  void refreshPairingContext({ silent: true });
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
  initializeCustomSelects();

  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.authSignInMode.addEventListener("click", () => setAuthMode("sign-in"));
  els.authSignUpMode.addEventListener("click", () => setAuthMode("sign-up"));
  els.authSignOutBtn.addEventListener("click", handleSignOut);
  els.plannerOwnerButtons.forEach((button) => {
    button.addEventListener("click", () => switchPlannerOwner(button.dataset.plannerOwner));
  });
  els.pairingForm.addEventListener("submit", handlePairingInviteSubmit);
  els.pairingAcceptBtn.addEventListener("click", () => respondToIncomingPairing(true));
  els.pairingDeclineBtn.addEventListener("click", () => respondToIncomingPairing(false));
  els.pairingCancelBtn.addEventListener("click", cancelOutgoingPairing);
  els.pairingRemoveBtn.addEventListener("click", removeAcceptedPairing);
  els.pairedNameToggleBtn.addEventListener("click", togglePairedNameEditor);
  els.pairedDisplayName.addEventListener("input", handlePairedDisplayNameInput);
  els.passwordToggleBtn.addEventListener("click", showPasswordFields);
  els.passwordCancelBtn.addEventListener("click", cancelPasswordChange);
  els.passwordForm.addEventListener("submit", handlePasswordChangeSubmit);
  els.deleteAccountStartBtn.addEventListener("click", showDeleteAccountConfirm);
  els.deleteAccountCancelBtn.addEventListener("click", hideDeleteAccountConfirm);
  els.deleteAccountConfirmInput.addEventListener("input", updateDeleteAccountConfirmState);
  els.deleteAccountConfirmBtn.addEventListener("click", handleDeleteAccountConfirm);

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
  els.recurringPanel.addEventListener("pointerleave", scheduleRecurringPanelClose);
  els.recurringPanelContent.addEventListener("pointerenter", openRecurringPanel);
  els.recurringPanelContent.addEventListener("pointerleave", scheduleRecurringPanelClose);
  els.recurringPanel.addEventListener("focusin", openRecurringPanel);
  els.recurringPanel.addEventListener("focusout", closeRecurringPanelAfterFocusLeaves);
  els.recurringPanelToggle.addEventListener("click", handleRecurringPanelToggleClick);

  els.deleteListButtons.forEach((button) => {
    const listType = button.dataset.deleteList;
    if (LIST_TYPES.includes(listType)) {
      button.addEventListener("click", () => showDeleteConfirm(listType));
    }
  });

  els.confirmDeleteButtons.forEach((button) => {
    button.addEventListener("click", () => deleteAllTasks(button.dataset.confirmDelete));
  });

  els.cancelDeleteButtons.forEach((button) => {
    button.addEventListener("click", () => hideDeleteConfirm(button.dataset.cancelDelete));
  });

  els.cancelEditButtons.forEach((button) => {
    button.addEventListener("click", () =>
      cancelTaskEdit(button.dataset.cancelEdit === "schedms" ? null : button.dataset.cancelEdit)
    );
  });

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handleTaskFormSubmit(form);
    });
  });

  els.schedmsAddForm.addEventListener("submit", handleSchedmsAddSubmit);

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
    if (isReadOnlyView()) {
      hydrateSettingsUI();
      return;
    }

    state.settings.timezoneOffset = els.timezoneOffset.value;
    saveState();
    runTimedUpdatesIfNeeded();
    renderAll();
  });

  els.dstAdjustment.addEventListener("change", () => {
    if (isReadOnlyView()) {
      hydrateSettingsUI();
      return;
    }

    state.settings.daylightSavingsAdjustment = els.dstAdjustment.checked ? 1 : 0;
    saveState();
    runTimedUpdatesIfNeeded();
    renderAll();
  });

}

function initializeCustomSelects() {
  document.querySelectorAll("select").forEach(enhanceSelect);

  document.addEventListener("pointerdown", (event) => {
    if (openCustomSelect && !openCustomSelect.contains(event.target)) {
      closeCustomSelect(openCustomSelect);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openCustomSelect) {
      const button = openCustomSelect.querySelector(".custom-select-button");
      closeCustomSelect(openCustomSelect);
      button?.focus();
    }
  });
}

function enhanceSelect(select) {
  if (select.dataset.customSelectReady === "true") {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "custom-select";
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const ariaLabel = select.getAttribute("aria-label");
  if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
  }

  const label = document.createElement("span");
  label.className = "custom-select-label";
  button.appendChild(label);

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  wrapper.append(button, menu);
  select.classList.add("native-select");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.dataset.customSelectReady = "true";

  button.addEventListener("click", () => toggleCustomSelect(wrapper));
  button.addEventListener("keydown", (event) => handleCustomSelectButtonKeydown(event, wrapper));
  select.addEventListener("change", () => syncCustomSelect(select));

  syncCustomSelect(select);
}

function syncCustomSelect(select) {
  const wrapper = select?.closest(".custom-select");
  if (!wrapper) {
    return;
  }

  const label = wrapper.querySelector(".custom-select-label");
  const button = wrapper.querySelector(".custom-select-button");
  const menu = wrapper.querySelector(".custom-select-menu");
  const selectedOption = select.selectedOptions[0] || select.options[select.selectedIndex] || select.options[0];

  label.textContent = selectedOption?.textContent || "";
  button.disabled = select.disabled;
  menu.innerHTML = "";

  [...select.options].forEach((option, index) => {
    if (option.hidden) {
      return;
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "custom-select-option";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(option.selected));
    item.disabled = option.disabled;
    item.dataset.optionIndex = String(index);
    item.textContent = option.textContent;
    item.addEventListener("click", () => selectCustomOption(select, index));
    item.addEventListener("keydown", handleCustomSelectOptionKeydown);
    menu.appendChild(item);
  });
}

function selectCustomOption(select, optionIndex) {
  select.selectedIndex = optionIndex;
  syncCustomSelect(select);
  closeCustomSelect(select.closest(".custom-select"));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function toggleCustomSelect(wrapper) {
  if (wrapper.classList.contains("open")) {
    closeCustomSelect(wrapper);
    return;
  }

  openCustomSelectMenu(wrapper);
}

function openCustomSelectMenu(wrapper) {
  if (openCustomSelect && openCustomSelect !== wrapper) {
    closeCustomSelect(openCustomSelect, true);
  }

  const select = wrapper.querySelector("select");
  const button = wrapper.querySelector(".custom-select-button");
  const menu = wrapper.querySelector(".custom-select-menu");
  syncCustomSelect(select);

  menu.hidden = false;
  wrapper.closest(".settings-dialog")?.classList.add("select-menu-open");
  wrapper.classList.remove("closing");
  wrapper.classList.add("open");
  button.setAttribute("aria-expanded", "true");
  openCustomSelect = wrapper;

  const selectedItem = menu.querySelector('[aria-selected="true"]:not(:disabled)') || menu.querySelector(":not(:disabled)");
  selectedItem?.scrollIntoView({ block: "nearest" });
}

function closeCustomSelect(wrapper = openCustomSelect, immediate = false) {
  if (!wrapper) {
    return;
  }

  const button = wrapper.querySelector(".custom-select-button");
  const menu = wrapper.querySelector(".custom-select-menu");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  wrapper.classList.remove("open");
  button?.setAttribute("aria-expanded", "false");

  if (openCustomSelect === wrapper) {
    openCustomSelect = null;
  }

  if (immediate || reduceMotion) {
    wrapper.classList.remove("closing");
    wrapper.closest(".settings-dialog")?.classList.remove("select-menu-open");
    menu.hidden = true;
    return;
  }

  wrapper.classList.add("closing");
  window.setTimeout(() => {
    wrapper.classList.remove("closing");
    if (!wrapper.classList.contains("open")) {
      wrapper.closest(".settings-dialog")?.classList.remove("select-menu-open");
      menu.hidden = true;
    }
  }, CUSTOM_SELECT_CLOSE_MS);
}

function handleCustomSelectButtonKeydown(event, wrapper) {
  if (![" ", "Enter", "ArrowDown", "ArrowUp"].includes(event.key)) {
    return;
  }

  event.preventDefault();
  openCustomSelectMenu(wrapper);
  const options = getFocusableCustomOptions(wrapper);
  const targetOption =
    event.key === "ArrowUp" ? options[options.length - 1] : wrapper.querySelector('[aria-selected="true"]:not(:disabled)');
  (targetOption || options[0])?.focus();
}

function handleCustomSelectOptionKeydown(event) {
  const wrapper = event.currentTarget.closest(".custom-select");
  const options = getFocusableCustomOptions(wrapper);
  const currentIndex = options.indexOf(event.currentTarget);

  if (event.key === "Escape") {
    event.preventDefault();
    closeCustomSelect(wrapper);
    wrapper.querySelector(".custom-select-button")?.focus();
    return;
  }

  if (event.key === "Tab") {
    closeCustomSelect(wrapper, true);
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.currentTarget.click();
    return;
  }

  const nextIndexByKey = {
    ArrowDown: Math.min(currentIndex + 1, options.length - 1),
    ArrowUp: Math.max(currentIndex - 1, 0),
    Home: 0,
    End: options.length - 1,
  };

  if (event.key in nextIndexByKey) {
    event.preventDefault();
    options[nextIndexByKey[event.key]]?.focus();
  }
}

function getFocusableCustomOptions(wrapper) {
  return [...wrapper.querySelectorAll(".custom-select-option:not(:disabled)")];
}

function handleSchedmsAddSubmit(event) {
  event.preventDefault();

  if (isReadOnlyView()) {
    return;
  }

  const text = els.schedmsInput.value.trim().slice(0, MAX_TASK_TEXT_LENGTH);
  const listType = normalizeSchedmsTargetList(els.schedmsTargetList.value);
  const isEditing = editState?.listSetId === "schedms";

  if (text.length < 1) {
    setSchedmsAddError("Task must be at least 1 character.");
    return;
  }

  if (isEditing) {
    updateSchedmsEditedTask(text, listType);
    return;
  }

  const taskId = crypto.randomUUID();
  const task = {
    id: taskId,
    text,
    done: false,
  };

  setSchedmsAddError("");
  state.listSets.schedms.tasks[listType].push(task);
  pendingAppendAnimations.add(taskId);
  window.setTimeout(() => pendingAppendAnimations.delete(taskId), 500);

  els.schedmsInput.value = "";
  saveState();
  renderAll();
  els.schedmsInput.focus();
}

function updateSchedmsEditedTask(text, nextListType) {
  if (isReadOnlyView() || editState?.listSetId !== "schedms") {
    return;
  }

  const activeSet = getActiveListSet();
  const previousListType = editState.listType;
  const tasks = activeSet.tasks[previousListType];
  const taskIndex = tasks.findIndex((item) => item.id === editState.taskId);

  if (taskIndex < 0) {
    cancelTaskEdit(previousListType);
    return;
  }

  const normalizedNextListType = normalizeSchedmsTargetList(nextListType);
  const beforePositions = new Map([[previousListType, captureTaskPositions(previousListType)]]);

  if (normalizedNextListType !== previousListType) {
    beforePositions.set(normalizedNextListType, captureTaskPositions(normalizedNextListType));
  }

  const task = tasks[taskIndex];
  task.text = text;

  if (normalizedNextListType !== previousListType) {
    tasks.splice(taskIndex, 1);
    activeSet.tasks[normalizedNextListType].push(task);
  }

  finishTaskEdit(normalizedNextListType);
  setSchedmsAddError("");
  saveState();
  renderAll();
  animateListReflow(previousListType, beforePositions.get(previousListType));

  if (normalizedNextListType !== previousListType) {
    animateListReflow(normalizedNextListType, beforePositions.get(normalizedNextListType));
  }
}

function normalizeSchedmsTargetList(listType) {
  return LIST_TYPES.includes(listType) ? listType : "daily";
}

function setSchedmsAddError(message) {
  els.schedmsAddError.textContent = message;
}

function playTaskCompleteSound() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  completionAudioContext ||= new AudioContextConstructor();

  if (completionAudioContext.state === "suspended") {
    completionAudioContext.resume().catch(() => {});
  }

  const startTime = completionAudioContext.currentTime + 0.01;
  const notes = [
    { frequency: 523.25, offset: 0, gain: 0.032, duration: 0.11 },
    { frequency: 659.25, offset: 0.045, gain: 0.026, duration: 0.12 },
    { frequency: 987.77, offset: 0.095, gain: 0.018, duration: 0.16 },
  ];

  notes.forEach((note) => {
    playCompletionTone(
      completionAudioContext,
      startTime + note.offset,
      note.frequency,
      note.gain,
      note.duration
    );
  });
}

function playCompletionTone(audioContext, startTime, frequency, peakGain, duration) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.018);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function handleTaskFormSubmit(form) {
  if (isReadOnlyView()) {
    return;
  }

  const listType = form.dataset.list;
  const input = getTaskInput(listType);
  const text = input.value.trim().slice(0, MAX_TASK_TEXT_LENGTH);
  const isTaskOptionsSubmit = isTaskOptionsOpenForList(listType);
  const isEditing = isEditingTask(listType);

  if (text.length < 1) {
    setFormError(listType, "Task must be at least 1 character.");
    return;
  }

  setFormError(listType, "");
  setRecurringError("");

  if (isEditing) {
    updateEditedTask(listType, text, isTaskOptionsSubmit);
    return;
  }

  addNewTask(listType, text, isTaskOptionsSubmit);
}

function addNewTask(listType, text, isTaskOptionsSubmit) {
  const taskId = crypto.randomUUID();
  const activeSet = getActiveListSet();

  if (isTaskOptionsSubmit) {
    activeSet.tasks.persistent.unshift(createRjTaskFromOptions(taskId, text));
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

function updateEditedTask(listType, text, isTaskOptionsSubmit) {
  if (isReadOnlyView()) {
    return;
  }

  const activeSet = getActiveListSet();
  const task = activeSet.tasks[listType].find((item) => item.id === editState.taskId);

  if (!task) {
    cancelTaskEdit(listType);
    return;
  }

  const beforePositions = captureTaskPositions(listType);
  const wasRecurring = isRecurringTask(task);
  const wasScheduled = isScheduledOneTimeTask(task);

  task.text = text;

  if (usesRecurringTaskGrouping(listType) && isTaskOptionsSubmit) {
    applyRjTaskOptions(task, !wasRecurring && !wasScheduled);
  } else if (usesRecurringTaskGrouping(listType) && (wasRecurring || wasScheduled)) {
    clearTaskTimingFields(task);
  }

  finishTaskEdit(listType);
  saveState();
  renderAll();
  animateListReflow(listType, beforePositions);
}

function createRjTaskFromOptions(taskId, text) {
  const task = {
    id: taskId,
    text,
    done: false,
  };

  applyRjTaskOptions(task, true);
  return task;
}

function applyRjTaskOptions(task, shouldResetDone) {
  const taskOption = getSelectedRjTaskOption();

  if (taskOption === RJ_TASK_OPTION_ONE_TIME) {
    clearTaskTimingFields(task);
    const showOnDate = getNextShowDateForSelectedDays();

    if (showOnDate) {
      task.showOnDate = showOnDate;
    }

    if (shouldResetDone) {
      task.done = false;
      delete task.completedOrder;
    }

    return;
  }

  applyRecurringTaskFields(task, shouldResetDone);
}

function applyRecurringTaskFields(task, shouldResetDone) {
  const todayId = dailyPeriodId(new Date());
  const taskOption = getSelectedRjTaskOption();
  const intervalDays = taskOption === RJ_TASK_OPTION_WEEKLY ? MAX_RECURRING_INTERVAL_DAYS : MIN_RECURRING_INTERVAL_DAYS;

  task.recurring = true;
  task.intervalDays = intervalDays;
  task.showDays = intervalDays === 7 ? getSelectedRecurringShowDays() : [];
  task.recurringStartDate = todayId;
  task.nextDueDate = addDaysToDateId(todayId, intervalDays);
  delete task.showOnDate;

  if (shouldResetDone) {
    task.done = false;
    delete task.completedOrder;
    task.lastCompletedDate = "";
    delete task.lastRestoredDate;
  }
}

function clearTaskTimingFields(task) {
  delete task.recurring;
  delete task.intervalDays;
  delete task.showDays;
  delete task.recurringStartDate;
  delete task.lastCompletedDate;
  delete task.lastRestoredDate;
  delete task.nextDueDate;
  delete task.showOnDate;
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
  closeCustomSelect(openCustomSelect, true);
  hideDeleteConfirm();
  cancelTaskEdit();
  state.activeListSet = nextListSetId;
  if (!isReadOnlyView()) {
    runTimedUpdatesIfNeeded();
    saveState();
  }
  renderAll();
}

function switchPlannerOwner(owner) {
  const nextOwner = owner === "partner" ? "partner" : "self";
  const visibleListSetId = getVisibleListSetId();

  if (plannerViewMode === nextOwner) {
    return;
  }

  if (nextOwner === "partner" && !getAcceptedPairing()) {
    return;
  }

  cleanupDragState();
  closeCustomSelect(openCustomSelect, true);
  hideDeleteConfirm();
  cancelTaskEdit();
  closeRecurringForm({ immediate: true });

  if (plannerViewMode === "self") {
    selfState = state;
  } else {
    partnerState = state;
  }

  plannerViewMode = nextOwner;
  state = plannerViewMode === "partner" ? partnerState || createPartnerFallbackState() : selfState;
  setPlannerStateListSet(state, visibleListSetId);
  hydrateSettingsUI();
  renderAll();
  renderPairingControls();
  renderSaveStatus();

  if (plannerViewMode === "partner") {
    void loadPartnerPlannerState();
  }
}

function openSettingsModal() {
  hydrateSettingsUI();
  hideDeleteConfirm();
  hidePairedNameEditor();
  resetPasswordSection();
  hideDeleteAccountConfirm({ restoreFocus: false });
  els.settingsModal.hidden = false;
  els.settingsOpenBtn.setAttribute("aria-expanded", "true");
  els.settingsCloseBtn.focus();
}

function closeSettingsModal() {
  closeCustomSelect(openCustomSelect, true);
  els.settingsModal.hidden = true;
  els.settingsOpenBtn.setAttribute("aria-expanded", "false");
  hideDeleteConfirm();
  hidePairedNameEditor();
  resetPasswordSection();
  hideDeleteAccountConfirm({ restoreFocus: false });
  els.settingsOpenBtn.focus();
}

function toggleRecurringForm() {
  if (isReadOnlyView()) {
    return;
  }

  setRecurringCreateMode(!recurringCreateMode);
}

function setRecurringCreateMode(isActive) {
  recurringCreateMode = Boolean(isActive);
  window.clearTimeout(recurringFormCloseTimer);
  recurringFormCloseTimer = null;

  if (recurringCreateMode) {
    const wasHidden = els.recurringForm.hidden;
    els.recurringForm.hidden = false;
    if (wasHidden) {
      els.recurringForm.classList.remove("show-days-open");
      els.recurringForm.getBoundingClientRect();
    }
  }

  els.recurringToggleBtn.classList.toggle("active", recurringCreateMode);
  els.recurringToggleBtn.setAttribute("aria-expanded", String(recurringCreateMode));
  els.recurringToggleBtn.title = recurringCreateMode ? "Hide task options" : "Task options";
  els.recurringToggleBtn.setAttribute("aria-label", els.recurringToggleBtn.title);
  els.lists.persistent.form.classList.toggle("recurring-create-mode", recurringCreateMode);
  updateRecurringShowDaysVisibility();
  updateTaskInputPlaceholder("persistent");
  setRecurringError("");

  if (!recurringCreateMode) {
    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : RECURRING_FORM_MOTION_MS;
    if (closeDelay === 0) {
      els.recurringForm.hidden = true;
      return;
    }

    recurringFormCloseTimer = window.setTimeout(() => {
      if (!recurringCreateMode) {
        els.recurringForm.hidden = true;
      }
      recurringFormCloseTimer = null;
    }, closeDelay);
  }
}

function closeRecurringForm({ immediate = false } = {}) {
  setRecurringCreateMode(false);

  if (immediate) {
    window.clearTimeout(recurringFormCloseTimer);
    recurringFormCloseTimer = null;
    els.recurringForm.hidden = true;
  }
}

function getTaskInput(listType) {
  return getTaskEditForm(listType).querySelector("input");
}

function getTaskSubmitButton(listType) {
  return getTaskEditForm(listType).querySelector(".add-task-submit-btn");
}

function getTaskEditCancelButton(listType) {
  return getTaskEditForm(listType).querySelector("[data-cancel-edit]");
}

function getTaskEditForm(listType) {
  return usesSchedmsEditBar() ? els.schedmsAddForm : els.lists[listType].form;
}

function usesSchedmsEditBar() {
  return state.activeListSet === "schedms";
}

function getTaskEditSurfaceKey(listType) {
  return usesSchedmsEditBar() ? "schedms" : listType;
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
      listType === "persistent" && recurringCreateMode ? "Edit to-do item options" : EDIT_TASK_PLACEHOLDERS[listType];
    return;
  }

  if (usesSchedmsEditBar()) {
    input.placeholder = "Add task";
    return;
  }

  input.placeholder =
    listType === "persistent" && isTaskOptionsOpenForList(listType)
      ? "Add to-do item with options"
      : ADD_TASK_PLACEHOLDERS[listType];
}

function setTaskFormEditingState(listType, isEditing) {
  const form = getTaskEditForm(listType);
  const submitButton = getTaskSubmitButton(listType);
  const cancelButton = getTaskEditCancelButton(listType);
  const taskLabel = getListTypeTaskLabel(listType);
  const editSurfaceKey = getTaskEditSurfaceKey(listType);

  clearEditCancelHideTimer(editSurfaceKey);
  cancelButton.hidden = false;
  cancelButton.disabled = !isEditing;
  cancelButton.setAttribute("aria-hidden", String(!isEditing));
  cancelButton.tabIndex = isEditing ? 0 : -1;
  form.classList.toggle("editing-task", isEditing);
  submitButton.textContent = isEditing ? SAVE_TASK_SYMBOL : ADD_TASK_SYMBOL;
  submitButton.setAttribute("aria-label", isEditing ? `Save ${taskLabel}` : `Add ${taskLabel}`);
  submitButton.title = isEditing ? "Save task" : "Add task";
  updateTaskInputPlaceholder(listType);

  if (usesSchedmsEditBar()) {
    syncCustomSelect(els.schedmsTargetList);
  }

  if (!isEditing) {
    hideEditCancelButtonAfterCollapse(editSurfaceKey, cancelButton);
  }
}

function clearEditCancelHideTimer(listType) {
  const timerId = editCancelHideTimers.get(listType);

  if (timerId !== undefined) {
    window.clearTimeout(timerId);
    editCancelHideTimers.delete(listType);
  }
}

function hideEditCancelButtonAfterCollapse(listType, cancelButton) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    cancelButton.hidden = true;
    return;
  }

  const timerId = window.setTimeout(() => {
    editCancelHideTimers.delete(listType);

    if (!isTaskEditSurfaceActive(listType)) {
      cancelButton.hidden = true;
    }
  }, EDIT_CANCEL_MOTION_MS + 30);

  editCancelHideTimers.set(listType, timerId);
}

function isTaskEditSurfaceActive(editSurfaceKey) {
  if (editSurfaceKey === "schedms") {
    return editState?.listSetId === "schedms";
  }

  return isEditingTask(editSurfaceKey);
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

  if (usesSchedmsEditBar()) {
    els.schedmsTargetList.value = listType;
    syncCustomSelect(els.schedmsTargetList);
  }

  if (usesRecurringTaskGrouping(listType)) {
    setRecurringCreateMode(isRecurringTask(task) || isScheduledOneTimeTask(task));
    hydrateRecurringControlsFromTask(task);
  } else {
    updateTaskInputPlaceholder(listType);
  }

  setTaskFormEditingState(listType, true);
}

function enterTaskEditMode(listType, taskId) {
  if (isReadOnlyView()) {
    return;
  }

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

  if (usesRecurringTaskGrouping(listType)) {
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
  setSchedmsAddError("");
  setRecurringError("");
  renderAll();
}

function hydrateRecurringControlsFromTask(task) {
  if (isRecurringTask(task)) {
    els.recurringInterval.value =
      normalizeRecurringIntervalDays(task?.intervalDays) === MAX_RECURRING_INTERVAL_DAYS ? "7" : "1";
    setRecurringShowDayControls(normalizeRecurringShowDays(task?.showDays));
  } else {
    els.recurringInterval.value = RJ_TASK_OPTION_ONE_TIME;
    setRecurringShowDayControls(getShowDaysFromDateId(task?.showOnDate));
  }

  updateRecurringShowDaysVisibility();
  syncCustomSelect(els.recurringInterval);
}

function setRecurringShowDayControls(showDays) {
  const normalizedShowDays = normalizeRecurringShowDays(showDays);
  const anyInput = getRecurringAnyDayInput();

  anyInput.checked = normalizedShowDays.length === 0;
  getRecurringShowDayInputs().forEach((input) => {
    input.checked = normalizedShowDays.includes(Number(input.value));
  });
}

function isTaskOptionsOpenForList(listType) {
  return state.activeListSet === "rj" && listType === "persistent" && recurringCreateMode;
}

function openRecurringPanel() {
  cancelScheduledRecurringPanelClose();
  setRecurringPanelOpen(true);
}

function closeRecurringPanel() {
  cancelScheduledRecurringPanelClose();
  setRecurringPanelOpen(false);
}

function closeRecurringPanelAfterFocusLeaves(event) {
  if (event.relatedTarget && els.recurringPanel.contains(event.relatedTarget)) {
    return;
  }

  closeRecurringPanel();
}

function scheduleRecurringPanelClose(event) {
  if (event?.relatedTarget && els.recurringPanel.contains(event.relatedTarget)) {
    return;
  }

  cancelScheduledRecurringPanelClose();
  recurringPanelHoverCloseTimer = window.setTimeout(() => {
    recurringPanelHoverCloseTimer = null;
    setRecurringPanelOpen(false);
  }, RECURRING_PANEL_CLOSE_DELAY_MS);
}

function cancelScheduledRecurringPanelClose() {
  if (recurringPanelHoverCloseTimer === null) {
    return;
  }

  window.clearTimeout(recurringPanelHoverCloseTimer);
  recurringPanelHoverCloseTimer = null;
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

  if (isDailyTaskOptionSelection()) {
    resetRecurringShowDayControls();
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
  els.recurringInterval.value = normalizeRjTaskOptionValue(els.recurringInterval.value);
  syncCustomSelect(els.recurringInterval);

  if (isDailyTaskOptionSelection()) {
    resetRecurringShowDayControls();
  }

  updateRecurringShowDaysVisibility();
}

function normalizeRjTaskOptionValue(value) {
  if (value === RJ_TASK_OPTION_ONE_TIME || value === "1" || value === "7") {
    return value;
  }

  return RJ_TASK_OPTION_ONE_TIME;
}

function getSelectedRjTaskOption() {
  const value = normalizeRjTaskOptionValue(els.recurringInterval.value);

  if (value === "1") {
    return RJ_TASK_OPTION_DAILY;
  }

  if (value === "7") {
    return RJ_TASK_OPTION_WEEKLY;
  }

  return RJ_TASK_OPTION_ONE_TIME;
}

function isDailyTaskOptionSelection() {
  return getSelectedRjTaskOption() === RJ_TASK_OPTION_DAILY;
}

function updateRecurringShowDaysVisibility() {
  const isVisible = recurringCreateMode;
  const isDisabled = isVisible && isDailyTaskOptionSelection();
  const field = els.recurringShowDays.closest(".recurring-days-field");

  els.recurringForm.classList.toggle("show-days-open", isVisible);
  field?.classList.toggle("show-days-open", isVisible);
  field?.classList.toggle("show-days-disabled", isDisabled);
  field?.setAttribute("aria-hidden", String(!isVisible));
  field?.setAttribute("aria-disabled", String(isDisabled));

  [...els.recurringShowDays.querySelectorAll("input")].forEach((input) => {
    input.disabled = !isVisible || isDisabled;
  });
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

function getNextShowDateForSelectedDays() {
  const showDays = getSelectedRecurringShowDays();

  if (showDays.length === 0) {
    return "";
  }

  const todayIndex = currentPlannerDayIndex();
  const offsetDays = showDays.reduce((bestOffset, dayIndex) => {
    const offset = (dayIndex - todayIndex + DAY_NAMES.length) % DAY_NAMES.length;
    return Math.min(bestOffset, offset);
  }, DAY_NAMES.length);

  return addCalendarDaysToDateId(dailyPeriodId(new Date()), offsetDays);
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

function showDeleteConfirm(confirmKey) {
  if (!LIST_TYPES.includes(confirmKey)) {
    return;
  }

  let activePanel = null;
  els.deleteConfirmPanels.forEach((panel) => {
    const isActive = panel.dataset.confirmList === confirmKey;
    panel.hidden = !isActive;
    panel.closest("[data-delete-control]")?.classList.toggle("confirming", isActive);
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
      const control = panel.closest("[data-delete-control]");
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
  if (isReadOnlyView()) {
    return;
  }

  if (!LIST_TYPES.includes(listType)) {
    return;
  }

  const activeSet = getActiveListSet();
  activeSet.tasks[listType] = [];
  if (isEditingTask(listType)) {
    finishTaskEdit(listType);
  }
  hideDeleteConfirm();
  saveState();
  renderAll();
}

function removeTaskFromList(listType, taskId) {
  const activeSet = getActiveListSet();
  const tasks = activeSet.tasks[listType];

  if (!Array.isArray(tasks)) {
    return false;
  }

  const nextTasks = tasks.filter((item) => item.id !== taskId);

  if (nextTasks.length === tasks.length) {
    return false;
  }

  activeSet.tasks[listType] = nextTasks;
  pendingAppendAnimations.delete(taskId);

  if (isEditingTask(listType, taskId)) {
    finishTaskEdit(listType);
  }

  return true;
}

function renderAll() {
  renderActiveLayout();
  renderListSetSwitcher();
  renderPlannerOwnerSwitcher();
  renderPairingControls();

  LIST_TYPES.forEach((listType) => {
    renderList(listType);
  });

  renderRecurringPanel();
  renderResetLabels();
}

function renderActiveLayout() {
  const isRjMode = state.activeListSet === "rj";
  const isReadOnly = isReadOnlyView();

  document.body.classList.toggle("rj-mode", isRjMode);
  els.app.classList.toggle("rj-mode", isRjMode);
  els.app.classList.toggle("partner-view", isReadOnly);
  els.schedmsQuickAdd.hidden = isReadOnly || isRjMode;
  els.rjProgress.hidden = !isRjMode;
  els.recurringTools.hidden = !isRjMode;
  els.recurringPanel.hidden = !isRjMode;
  els.timezoneOffset.disabled = isReadOnly;
  els.dstAdjustment.disabled = isReadOnly;
  syncCustomSelect(els.timezoneOffset);
  els.recurringToggleBtn.disabled = isReadOnly;
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

function renderPlannerOwnerSwitcher() {
  const acceptedPairing = getAcceptedPairing();

  els.plannerOwnerSwitcher.hidden = !acceptedPairing;
  els.partnerOwnerSwitch.textContent = acceptedPairing ? getPairingDisplayName(acceptedPairing) : "Partner";

  els.plannerOwnerButtons.forEach((button) => {
    const isActive = button.dataset.plannerOwner === plannerViewMode;
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
  const isReadOnly = isReadOnlyView();

  const orderedTasks = orderTasksForList(listType, taskSet);
  const visibleTasks = getVisibleTasksForList(listType, orderedTasks);
  formEl.style.display = shouldShowListForm(listType) ? "" : "none";
  setFormError(listType, "");

  listEl.innerHTML = "";

  visibleTasks.forEach((task) => {
    const isTaskEditing = isEditingTask(listType, task.id);
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""} ${isRecurringTask(task) ? "recurring-task" : ""}`;
    li.dataset.taskId = task.id;
    li.dataset.recurring = String(isRecurringTask(task));
    li.dataset.taskGroup = getRjTaskGroup(task);
    li.draggable = !isReadOnly && !isTaskEditing && !task.done;

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
      if (task.done || isTaskEditing) {
        event.preventDefault();
        return;
      }

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
      repeatBadge.textContent = "\u21bb";
      repeatBadge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
      label.appendChild(repeatBadge);
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

    if (!isReadOnly) {
      actions.append(editBtn, deleteBtn);
    }

    if (isReadOnly || isTaskEditing) {
      checkbox.disabled = true;
      editBtn.disabled = true;
      deleteBtn.disabled = true;
    }

    let taskActionStarted = false;
    let taskPointerStart = null;

    const setTaskDone = (nextDone) => {
      if (isReadOnlyView()) {
        checkbox.checked = task.done;
        return;
      }

      if (taskActionStarted) {
        return;
      }

      if (task.done === nextDone) {
        return;
      }

      taskActionStarted = true;
      if (nextDone) {
        playTaskCompleteSound();
      }

      const commitDoneChange = () => {
        const beforePositions = captureTaskPositions(listType);
        moveTaskAfterDoneChange(listType, task.id, nextDone);
        saveState();
        renderAll();
        animateListReflow(listType, beforePositions);
      };

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
      if (isReadOnlyView()) {
        return;
      }

      if (taskActionStarted) {
        return;
      }

      taskActionStarted = true;
      checkbox.disabled = true;
      deleteBtn.disabled = true;
      editBtn.disabled = true;
      li.draggable = false;

      if (!removeTaskFromList(listType, task.id)) {
        renderAll();
        return;
      }

      saveState();

      if (usesRecurringTaskGrouping(listType)) {
        renderRecurringPanel();
        renderRjProgress();
      }

      emptyEl.style.display = "none";

      runTaskExitAnimation(li, "remove-exit", () => {
        removeExitedTaskItem(listType, li);
      });
    };

    const editTask = () => {
      if (isReadOnlyView()) {
        return;
      }

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

    li.append(label, actions);
    listEl.appendChild(li);
  });

  emptyEl.style.display = visibleTasks.length === 0 ? "block" : "none";
}

function renderRecurringPanel() {
  const isReadOnly = isReadOnlyView();
  const scheduledTasks =
    state.activeListSet === "rj" ? getScheduledPanelTasks(getActiveListSet().tasks.persistent) : [];

  els.recurringPanelCount.textContent = String(scheduledTasks.length);
  els.recurringPanelList.innerHTML = "";

  scheduledTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = `recurring-summary-item ${task.done ? "done" : ""} ${
      doesScheduledTaskShowToday(task) ? "is-active" : ""
    }`;

    const copy = document.createElement("div");
    copy.className = "recurring-summary-copy";

    const title = document.createElement("span");
    title.className = "recurring-summary-title";
    title.textContent = task.text;

    const meta = document.createElement("span");
    meta.className = "recurring-summary-meta";
    meta.textContent = formatScheduledPanelMeta(task);

    const status = shouldShowScheduledPanelStatusBadge(task) ? document.createElement("span") : null;

    if (status) {
      status.className = `recurring-summary-status ${task.done ? "done" : ""} ${
        doesScheduledTaskShowToday(task) ? "active" : ""
      }`;
      status.textContent = formatScheduledPanelStatus(task);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-action-btn delete-btn recurring-summary-delete";
    deleteBtn.setAttribute("aria-label", `Remove scheduled task: ${task.text}`);
    deleteBtn.title = "Remove scheduled task";

    const trashIcon = document.createElement("span");
    trashIcon.className = "trash-icon";
    trashIcon.setAttribute("aria-hidden", "true");
    deleteBtn.appendChild(trashIcon);
    let didDelete = false;

    const deleteScheduledTask = () => {
      if (isReadOnlyView()) {
        return;
      }

      if (didDelete) {
        return;
      }

      didDelete = true;
      if (!removeTaskFromList("persistent", task.id)) {
        renderAll();
        return;
      }

      saveState();
      renderAll();
    };

    const restoreRecurringTask = () => {
      if (isReadOnlyView()) {
        return;
      }

      if (!isRecurringTask(task) || !task.done || didDelete) {
        return;
      }

      const beforePositions = captureTaskPositions("persistent");
      moveTaskAfterDoneChange("persistent", task.id, false);
      saveState();
      renderAll();
      animateListReflow("persistent", beforePositions);
    };

    if (!isReadOnly && isRecurringTask(task) && task.done) {
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
      deleteScheduledTask();
    });

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteScheduledTask();
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

    if (!isReadOnly) {
      li.appendChild(deleteBtn);
    }
    els.recurringPanelList.appendChild(li);
  });

  els.recurringPanelEmpty.style.display = scheduledTasks.length === 0 ? "block" : "none";
}

function getScheduledPanelTasks(tasks) {
  return tasks.filter((task) => isScheduledPanelTask(task)).sort(compareScheduledPanelTasks);
}

function isScheduledPanelTask(task) {
  if (isRecurringTask(task)) {
    return true;
  }

  const showOnDate = normalizeDateId(task?.showOnDate);
  return Boolean(showOnDate) && !task.done && showOnDate >= dailyPeriodId(new Date());
}

function compareScheduledPanelTasks(taskA, taskB) {
  if (isRecurringTask(taskA) && isRecurringTask(taskB) && taskA.done && taskB.done) {
    const completionOrder = getTaskCompletionOrder(taskA) - getTaskCompletionOrder(taskB);

    if (completionOrder !== 0) {
      return completionOrder;
    }
  }

  const dateA = getTaskAppearanceDateId(taskA);
  const dateB = getTaskAppearanceDateId(taskB);

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  const typeOrder = getScheduledTaskTypeOrder(taskA) - getScheduledTaskTypeOrder(taskB);

  if (typeOrder !== 0) {
    return typeOrder;
  }

  return taskA.text.localeCompare(taskB.text);
}

function shouldShowListForm(listType) {
  if (isReadOnlyView()) {
    return false;
  }

  if (state.activeListSet === "rj") {
    return listType === "persistent";
  }

  return false;
}

function orderTasksForList(listType, tasks) {
  if (!usesRecurringTaskGrouping(listType)) {
    return orderTasksByDone(tasks);
  }

  return orderRjPersistentTasks(tasks);
}

function orderRjPersistentTasks(tasks) {
  return RJ_TASK_GROUPS.flatMap((group) => {
    const groupTasks = tasks.filter((task) => getRjTaskGroup(task) === group);
    return group === "done" ? sortTasksByCompletionOrder(groupTasks) : groupTasks;
  });
}

function getVisibleTasksForList(listType, tasks) {
  return tasks.filter((task) => isTaskVisibleInList(listType, task));
}

function isTaskVisibleInList(listType, task) {
  if (!isTaskAvailableByDate(task)) {
    return false;
  }

  if (state.activeListSet === "schedms") {
    return true;
  }

  if (!usesRecurringTaskGrouping(listType) || !isRecurringTask(task)) {
    return true;
  }

  const todayId = dailyPeriodId(new Date());

  if (task.done) {
    return normalizeDateId(task.lastCompletedDate) === todayId;
  }

  const wasRestoredToday = normalizeDateId(task.lastRestoredDate) === todayId;

  return !task.done && (wasRestoredToday || doesRecurringTaskShowToday(task));
}

function isTaskAvailableByDate(task) {
  const showOnDate = normalizeDateId(task?.showOnDate);

  return !showOnDate || showOnDate <= dailyPeriodId(new Date());
}

function usesRecurringTaskGrouping(listType) {
  return state.activeListSet === "rj" && listType === "persistent";
}

function isRecurringTask(task) {
  return task?.recurring === true;
}

function isScheduledOneTimeTask(task) {
  return !isRecurringTask(task) && Boolean(normalizeDateId(task?.showOnDate));
}

function normalizeCompletionOrder(value) {
  const order = Number(value);
  return Number.isSafeInteger(order) && order > 0 ? order : null;
}

function getTaskCompletionOrder(task) {
  return normalizeCompletionOrder(task?.completedOrder) ?? Number.MAX_SAFE_INTEGER;
}

function sortTasksByCompletionOrder(tasks) {
  return [...tasks].sort((taskA, taskB) => getTaskCompletionOrder(taskA) - getTaskCompletionOrder(taskB));
}

function getNextCompletionOrder() {
  let maxOrder = 0;

  LIST_SET_IDS.forEach((listSetId) => {
    LIST_TYPES.forEach((listType) => {
      state.listSets[listSetId].tasks[listType].forEach((task) => {
        maxOrder = Math.max(maxOrder, normalizeCompletionOrder(task?.completedOrder) ?? 0);
      });
    });
  });

  return maxOrder + 1;
}

function setTaskCompletionState(task, done) {
  task.done = done;

  if (done) {
    task.completedOrder = getNextCompletionOrder();
  } else {
    delete task.completedOrder;
  }
}

function resetTaskCompletion(task) {
  const nextTask = {
    ...task,
    done: false,
  };

  delete nextTask.completedOrder;
  return nextTask;
}

function backfillCompletionOrders(targetState) {
  let maxOrder = 0;
  let didBackfill = false;

  LIST_SET_IDS.forEach((listSetId) => {
    LIST_TYPES.forEach((listType) => {
      targetState.listSets[listSetId].tasks[listType].forEach((task) => {
        maxOrder = Math.max(maxOrder, normalizeCompletionOrder(task?.completedOrder) ?? 0);
      });
    });
  });

  LIST_SET_IDS.forEach((listSetId) => {
    LIST_TYPES.forEach((listType) => {
      targetState.listSets[listSetId].tasks[listType].forEach((task) => {
        if (!task.done || normalizeCompletionOrder(task?.completedOrder) !== null) {
          return;
        }

        maxOrder += 1;
        task.completedOrder = maxOrder;
        didBackfill = true;
      });
    });
  });

  return didBackfill;
}

function getRjTaskGroup(task) {
  if (task.done) {
    return "done";
  }

  return isRecurringTask(task) ? "recurring-open" : "one-time-open";
}

function orderTasksByDone(tasks) {
  return [...tasks.filter((task) => !task.done), ...sortTasksByCompletionOrder(tasks.filter((task) => task.done))];
}

function moveTaskAfterDoneChange(listType, taskId, done) {
  const activeSet = getActiveListSet();
  const tasks = activeSet.tasks[listType];
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex < 0) {
    return;
  }

  const task = tasks[taskIndex];
  setTaskCompletionState(task, done);

  if (usesRecurringTaskGrouping(listType) && isRecurringTask(task)) {
    const todayId = dailyPeriodId(new Date());

    if (done) {
      const currentNextDueDate = normalizeDateId(task.nextDueDate);
      task.lastCompletedDate = todayId;
      task.recurringStartDate = normalizeDateId(task.recurringStartDate) || todayId;
      task.nextDueDate =
        currentNextDueDate && currentNextDueDate > todayId
          ? currentNextDueDate
          : addDaysToDateId(todayId, task.intervalDays);
      delete task.lastRestoredDate;
    } else {
      task.recurringStartDate = todayId;
      task.lastRestoredDate = todayId;
      task.nextDueDate = addDaysToDateId(task.recurringStartDate, task.intervalDays);
    }
  }
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
  const formEl = getTaskEditForm(listType);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !targetInput || !sourceCopy) {
    prepareTaskEditMode(listType, task);
    renderAll();
    onDone();
    return;
  }

  let finished = false;
  if (formEl.style.display === "none") {
    formEl.style.display = "";
  }

  const sourceRect = itemEl.getBoundingClientRect();
  const inputStartRect = targetInput.getBoundingClientRect();
  const sourceCopyRect = sourceCopy.getBoundingClientRect();
  const itemStyles = window.getComputedStyle(itemEl);
  const copyStyles = window.getComputedStyle(sourceCopy);

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
    cancelFinalWidth,
    cancelMeasurement.marginLeft
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
  const targetWidth = "2.45rem";
  const previousTransition = cancelButton.style.transition;
  const previousFlexBasis = cancelButton.style.flexBasis;
  const previousWidth = cancelButton.style.width;
  const previousBorderWidth = cancelButton.style.borderWidth;
  const previousOpacity = cancelButton.style.opacity;
  const previousTransform = cancelButton.style.transform;

  cancelButton.style.transition = "none";
  cancelButton.style.flexBasis = targetWidth;
  cancelButton.style.width = targetWidth;
  cancelButton.style.borderWidth = "1px";
  cancelButton.style.opacity = "1";
  cancelButton.style.transform = "none";

  const width = cancelButton.getBoundingClientRect().width;

  return {
    width,
    marginLeft: window.getComputedStyle(cancelButton).marginLeft,
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

function animateTaskFormControlsForEdit(listType, startInputWidth, endInputWidth, endCancelWidth, endCancelMarginLeft) {
  const form = getTaskEditForm(listType);
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
  const previousCancelMarginLeft = cancelButton.style.marginLeft;
  const easing = "cubic-bezier(0.22, 0.72, 0.2, 1)";
  const inputTiming = `flex-basis ${EDIT_TASK_MOTION_MS}ms ${easing}, width ${EDIT_TASK_MOTION_MS}ms ${easing}, max-width ${EDIT_TASK_MOTION_MS}ms ${easing}`;
  const cancelTiming = `flex-basis ${EDIT_CANCEL_MOTION_MS}ms ${easing}, width ${EDIT_CANCEL_MOTION_MS}ms ${easing}, margin-left ${EDIT_CANCEL_MOTION_MS}ms ${easing}, opacity 120ms ease, border-width ${EDIT_CANCEL_MOTION_MS}ms ${easing}`;

  input.style.transition = "none";
  input.style.flex = `0 0 ${startInputWidth}px`;
  input.style.width = `${startInputWidth}px`;
  input.style.maxWidth = `${startInputWidth}px`;
  cancelButton.style.transition = "none";
  cancelButton.style.flexBasis = "0px";
  cancelButton.style.width = "0px";
  cancelButton.style.borderWidth = "0";
  cancelButton.style.opacity = "0";
  cancelButton.style.transform = "none";
  cancelButton.style.marginLeft = "0px";
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
    cancelButton.style.transform = "none";
    cancelButton.style.marginLeft = endCancelMarginLeft;
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
    cancelButton.style.marginLeft = previousCancelMarginLeft;
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

  const draggedTask = getActiveListSet().tasks[listType].find((task) => task.id === dragState.taskId);

  if (!draggedTask || draggedTask.done) {
    cleanupDragState();
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
  if (isReadOnlyView()) {
    event.preventDefault();
    cleanupDragState();
    return;
  }

  if (dragState.listType !== listType || !dragState.taskId) {
    return;
  }

  const draggedTask = getActiveListSet().tasks[listType].find((task) => task.id === dragState.taskId);

  if (!draggedTask || draggedTask.done) {
    cleanupDragState();
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
  const taskItems = getDraggableTaskItems(listType);

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

  if (!draggedTask || draggedTask.done) {
    return insertIndex;
  }

  const groupRange = getVisibleTaskGroupRange(listType, getRjTaskGroup(draggedTask));

  return Math.max(groupRange.start, Math.min(insertIndex, groupRange.end));
}

function getVisibleTaskGroupRange(listType, targetGroup) {
  const taskItems = getDraggableTaskItems(listType);
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
  const taskItems = getDraggableTaskItems(listType);
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
  const tasks = activeSet.tasks[listType];
  const draggedTask = tasks.find((task) => task.id === dragId);

  if (!draggedTask || draggedTask.done) {
    return;
  }

  if (usesRecurringTaskGrouping(listType)) {
    reorderRecurringAwareTask(listType, dragId, insertIndex, tasks, draggedTask);
    return;
  }

  const visibleDraggableTasks = getVisibleTasksForList(listType, tasks).filter((task) => !task.done);
  const reorderedVisibleTasks = visibleDraggableTasks.filter((task) => task.id !== dragId);
  const fromIndex = visibleDraggableTasks.findIndex((task) => task.id === dragId);

  if (fromIndex < 0) {
    return;
  }

  const boundedIndex = Math.max(0, Math.min(insertIndex, reorderedVisibleTasks.length));

  reorderedVisibleTasks.splice(boundedIndex, 0, draggedTask);

  activeSet.tasks[listType] = mergeVisibleTaskOrder(
    tasks,
    reorderedVisibleTasks,
    listType,
    (task) => !task.done && isTaskVisibleInList(listType, task)
  );
}

function getDraggableTaskItems(listType) {
  return [...els.lists[listType].list.querySelectorAll(".task-item:not(.dragging):not(.done)")];
}

function reorderRecurringAwareTask(listType, dragId, insertIndex, orderedTasks, draggedTask) {
  const activeSet = getActiveListSet();
  const draggedGroup = getRjTaskGroup(draggedTask);
  const groupTasks = orderedTasks.filter((task) => getRjTaskGroup(task) === draggedGroup);
  const visibleGroupTasks = groupTasks.filter((task) => isTaskVisibleInList(listType, task));
  const reorderedVisibleTasks = visibleGroupTasks.filter((task) => task.id !== dragId);
  const visibleDraggableTasks = getVisibleTasksForList(listType, orderedTasks).filter((task) => !task.done);
  const groupStartIndex = RJ_TASK_GROUPS.slice(0, RJ_TASK_GROUPS.indexOf(draggedGroup)).reduce(
    (count, group) => count + visibleDraggableTasks.filter((task) => getRjTaskGroup(task) === group).length,
    0
  );
  const groupInsertIndex = insertIndex - groupStartIndex;
  const boundedIndex = Math.max(0, Math.min(groupInsertIndex, reorderedVisibleTasks.length));

  reorderedVisibleTasks.splice(boundedIndex, 0, draggedTask);

  activeSet.tasks[listType] = mergeVisibleTaskOrder(
    orderedTasks,
    reorderedVisibleTasks,
    listType,
    (task) => getRjTaskGroup(task) === draggedGroup && !task.done && isTaskVisibleInList(listType, task)
  );
}

function mergeVisibleTaskOrder(groupTasks, reorderedVisibleTasks, listType, shouldMergeTask = (task) => isTaskVisibleInList(listType, task)) {
  let visibleIndex = 0;

  return groupTasks.map((task) => {
    if (!shouldMergeTask(task)) {
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
  els.pairedDisplayName.value = selfState?.settings?.pairedAccountDisplayName || "";
  syncCustomSelect(els.timezoneOffset);
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

    const lastCompletedDate = normalizeDateId(task.lastCompletedDate);
    const nextDueDate = normalizeDateId(task.nextDueDate);
    const shouldClearExpiredCompletion = task.done && lastCompletedDate !== todayId;
    const shouldRefreshDueDate = !nextDueDate || nextDueDate <= todayId;

    if (!shouldClearExpiredCompletion && !shouldRefreshDueDate) {
      return task;
    }

    didRefresh = true;

    const refreshedTask = {
      ...task,
    };

    if (shouldRefreshDueDate) {
      refreshedTask.recurringStartDate = todayId;
      refreshedTask.nextDueDate = addDaysToDateId(todayId, task.intervalDays);
    }

    if (shouldClearExpiredCompletion) {
      refreshedTask.done = false;
      refreshedTask.lastCompletedDate = "";
      delete refreshedTask.completedOrder;
      delete refreshedTask.lastRestoredDate;
    } else if (!refreshedTask.done) {
      refreshedTask.lastCompletedDate = "";
      delete refreshedTask.completedOrder;
    }

    return refreshedTask;
  });

  if (didRefresh) {
    saveState();
  }

  return didRefresh;
}

function runResetsIfNeeded() {
  const now = new Date();
  const nextDailyPeriodId = schedmsDailyPeriodId(now);
  const nextWeeklyPeriodId = schedmsWeeklyPeriodId(now);
  const nextPersistentPeriodIds = {
    schedms: nextDailyPeriodId,
    rj: dailyPeriodId(now),
  };
  const listSet = state.listSets.schedms;
  let didReset = false;

  if (listSet.periodIds.daily !== nextDailyPeriodId) {
    listSet.periodIds.daily = nextDailyPeriodId;
    listSet.tasks.daily = listSet.tasks.daily.map(resetTaskCompletion);
    didReset = true;
  }

  if (listSet.periodIds.weekly !== nextWeeklyPeriodId) {
    listSet.periodIds.weekly = nextWeeklyPeriodId;
    listSet.tasks.weekly = listSet.tasks.weekly.map(resetTaskCompletion);
    didReset = true;
  }

  LIST_SET_IDS.forEach((listSetId) => {
    const targetListSet = state.listSets[listSetId];
    const nextPersistentPeriodId = nextPersistentPeriodIds[listSetId];

    if (!targetListSet.periodIds.persistent) {
      targetListSet.periodIds.persistent = nextPersistentPeriodId;
      didReset = true;
      return;
    }

    if (targetListSet.periodIds.persistent !== nextPersistentPeriodId) {
      targetListSet.periodIds.persistent = nextPersistentPeriodId;
      targetListSet.tasks.persistent = removeCompletedToDoAssignments(targetListSet.tasks.persistent);
      didReset = true;
    }
  });

  if (didReset) {
    saveState();
  }

  return didReset;
}

function removeCompletedToDoAssignments(tasks) {
  return tasks.filter((task) => isRecurringTask(task) || !task.done);
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

function normalizePairedDisplayName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_PAIRED_DISPLAY_NAME_LENGTH);
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

function addCalendarDaysToDateId(dateId, dayCount) {
  const [year, month, day] = normalizeDateId(dateId).split("-").map(Number);
  const offsetDays = Number(dayCount);

  if (!year || !month || !day || !Number.isFinite(offsetDays)) {
    return dailyPeriodId(new Date());
  }

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  dateObj.setUTCDate(dateObj.getUTCDate() + offsetDays);

  return formatDateParts(dateObj);
}

function getShowDaysFromDateId(dateId) {
  const utcTime = dateIdToUtcTime(dateId);

  if (utcTime === null) {
    return [];
  }

  return [new Date(utcTime).getUTCDay()];
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
    return "Daily";
  }

  if (normalizedInterval === 7) {
    return "Weekly";
  }

  return "Daily";
}

function formatRecurringShowDays(task) {
  const showDays = getEffectiveRecurringShowDays(task);

  if (showDays.length === 0) {
    return "Any day";
  }

  return showDays.map((dayIndex) => DAY_SHORT_NAMES[dayIndex]).join(", ");
}

function formatScheduledPanelMeta(task) {
  const metaParts = [formatScheduledTaskTypeLabel(task), formatTaskAppearanceLabel(task)];

  if (isRecurringTask(task) && getEffectiveRecurringShowDays(task).length > 0) {
    metaParts.push(formatRecurringShowDays(task));
  }

  return metaParts.join(" | ");
}

function formatScheduledTaskTypeLabel(task) {
  if (!isRecurringTask(task)) {
    return "One-time";
  }

  return formatRecurringIntervalLabel(task.intervalDays);
}

function shouldShowScheduledPanelStatusBadge(task) {
  return task.done || doesScheduledTaskShowToday(task);
}

function formatScheduledPanelStatus(task) {
  if (task.done) {
    return "Done";
  }

  if (doesScheduledTaskShowToday(task)) {
    return "On list";
  }

  return formatTaskAppearanceLabel(task);
}

function doesScheduledTaskShowToday(task) {
  return getTaskAppearanceDateId(task) === dailyPeriodId(new Date()) && !task.done;
}

function formatTaskAppearanceLabel(task) {
  return `Appears ${formatAppearanceDateLabel(getTaskAppearanceDateId(task))}`;
}

function formatAppearanceDateLabel(dateId) {
  const todayId = dailyPeriodId(new Date());
  const tomorrowId = addCalendarDaysToDateId(todayId, 1);

  if (dateId === todayId) {
    return "today";
  }

  if (dateId === tomorrowId) {
    return "tomorrow";
  }

  const utcTime = dateIdToUtcTime(dateId);

  if (utcTime === null) {
    return "soon";
  }

  return formatPlannerDate(new Date(utcTime), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getTaskAppearanceDateId(task) {
  if (!isRecurringTask(task)) {
    return normalizeDateId(task?.showOnDate) || dailyPeriodId(new Date());
  }

  return getNextRecurringAppearanceDateId(task);
}

function getNextRecurringAppearanceDateId(task) {
  const todayId = dailyPeriodId(new Date());
  const dueDate = normalizeDateId(task.nextDueDate);
  const fallbackStartDate = normalizeDateId(task.recurringStartDate) || todayId;

  if (task.done) {
    return dueDate || addDaysToDateId(fallbackStartDate, task.intervalDays);
  }

  if (doesRecurringTaskShowToday(task)) {
    return todayId;
  }

  const showDays = getEffectiveRecurringShowDays(task);

  if (showDays.length === 0) {
    return todayId;
  }

  return getNextDateIdForShowDays(showDays, todayId);
}

function getNextDateIdForShowDays(showDays, startDateId) {
  const normalizedStartDate = normalizeDateId(startDateId) || dailyPeriodId(new Date());

  for (let offsetDays = 0; offsetDays <= DAY_NAMES.length; offsetDays += 1) {
    const dateId = addCalendarDaysToDateId(normalizedStartDate, offsetDays);
    const utcTime = dateIdToUtcTime(dateId);

    if (utcTime !== null && showDays.includes(new Date(utcTime).getUTCDay())) {
      return dateId;
    }
  }

  return normalizedStartDate;
}

function getScheduledTaskTypeOrder(task) {
  if (!isRecurringTask(task)) {
    return 2;
  }

  return normalizeRecurringIntervalDays(task.intervalDays) === MIN_RECURRING_INTERVAL_DAYS ? 0 : 1;
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
      const completedOrder = normalizeCompletionOrder(task?.completedOrder);
      const showOnDate = normalizeDateId(task?.showOnDate);

      if (normalizedTask.done && completedOrder !== null) {
        normalizedTask.completedOrder = completedOrder;
      }

      if (!recurring && showOnDate) {
        normalizedTask.showOnDate = showOnDate;
      }

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
      persistent: String(listSet?.periodIds?.persistent || defaults.periodIds.persistent),
    },
    tasks: {
      daily: normalizeTaskSet(listSet?.tasks?.daily),
      weekly: normalizeTaskSet(listSet?.tasks?.weekly),
      persistent: normalizeTaskSet(listSet?.tasks?.persistent ?? listSet?.tasks?.todo),
    },
  };
}

function loadState() {
  return loadStateFromStorage(activeStorageKey);
}

function loadStateFromStorage(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return normalizeStateData(raw ? JSON.parse(raw) : null);
  } catch {
    return structuredClone(defaultState);
  }
}

function hasStoredState(storageKey = activeStorageKey) {
  try {
    return localStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

function getUserStorageKey(userId) {
  return `${STORAGE_KEY}:${userId}`;
}

function normalizeStateData(parsed) {
  if (!parsed) {
    return structuredClone(defaultState);
  }

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
      pairedAccountDisplayName: normalizePairedDisplayName(parsed?.settings?.pairedAccountDisplayName),
    },
    lastSavedAt: normalizeSavedAt(parsed?.lastSavedAt),
    activeListSet: normalizeListSetId(parsed?.activeListSet),
    listSets,
  };
}

async function initializeSupabaseSync() {
  setAuthMessage("Connecting to Supabase...");
  setAuthLoading(true);

  try {
    const { createClient } = await importSupabaseClient();
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!session?.user && supabaseUserId) {
        showAuthView();
      }
    });

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data.session?.user) {
      showAuthView("Sign in to load your planner.");
      return;
    }

    await loadAuthenticatedPlanner(data.session.user);
  } catch (error) {
    showAuthView(`Supabase error: ${formatSupabaseError(error)}`, true);
  } finally {
    setAuthLoading(false);
  }
}

async function importSupabaseClient() {
  try {
    return await import(SUPABASE_CLIENT_MODULE_URL);
  } catch (primaryError) {
    try {
      return await import(SUPABASE_CLIENT_FALLBACK_MODULE_URL);
    } catch (fallbackError) {
      throw new Error(
        `Could not load Supabase client. Primary: ${formatSupabaseError(primaryError)}. Fallback: ${formatSupabaseError(fallbackError)}`
      );
    }
  }
}

async function loadAuthenticatedPlanner(user) {
  setSupabaseSyncStatus("connecting");
  supabaseUserId = user.id;
  signedInUserEmail = user.email || "Signed in";
  activeStorageKey = getUserStorageKey(user.id);
  plannerViewMode = "self";
  partnerState = null;
  pairingContext = createEmptyPairingContext();

  await upsertPlannerProfile(user);

  const hasUserLocalState = hasStoredState(activeStorageKey);
  const userLocalState = hasUserLocalState ? loadStateFromStorage(activeStorageKey) : null;
  const remoteState = await loadSupabaseState();
  const shouldMigrateLegacyState = shouldImportLegacyState(user.id, hasUserLocalState, remoteState);
  const localState = shouldMigrateLegacyState ? loadStateFromStorage(STORAGE_KEY) : userLocalState;
  const hasLocalState = Boolean(localState);
  const shouldUseRemoteState = remoteState && (!hasLocalState || isStateNewer(remoteState, localState));
  let shouldUploadState = !remoteState || (!shouldUseRemoteState && hasLocalState && isStateNewer(localState, remoteState));

  state = shouldUseRemoteState ? remoteState : localState || structuredClone(defaultState);
  showInitialListSet();
  if (!state.lastSavedAt) {
    state.lastSavedAt = new Date().toISOString();
    shouldUploadState = true;
  }
  selfState = state;

  const didAuthBackfill = backfillCompletionOrders(state);
  const didAuthTimedUpdate = runTimedUpdatesIfNeeded();

  if (didAuthBackfill || didAuthTimedUpdate) {
    shouldUploadState = true;
  }

  persistLocalState();
  await refreshPairingContext({ silent: true });
  hydrateStateUIAfterRemoteLoad();
  showPlannerView();

  supabaseSyncReady = true;
  setSupabaseSyncStatus("synced");

  if (shouldMigrateLegacyState) {
    pendingLegacyMigrationUserId = user.id;
  }

  if (shouldUploadState || shouldMigrateLegacyState) {
    queueSupabaseSync();
  }
}

function shouldImportLegacyState(userId, hasUserLocalState, remoteState) {
  if (hasUserLocalState || remoteState || !hasStoredState(STORAGE_KEY)) {
    return false;
  }

  try {
    return localStorage.getItem(AUTH_MIGRATION_KEY) !== userId;
  } catch {
    return true;
  }
}

function createEmptyPairingContext() {
  return {
    accepted: null,
    incoming: null,
    outgoing: null,
    profiles: {},
  };
}

async function upsertPlannerProfile(user) {
  const email = String(user.email || "").trim().toLowerCase();

  if (!email) {
    throw new Error("Supabase did not return an email for this user.");
  }

  const { error } = await supabaseClient.from(SUPABASE_PROFILE_TABLE).upsert({
    owner_id: user.id,
    email,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  signedInUserEmail = email;
}

async function refreshPairingContext({ silent = false } = {}) {
  if (!supabaseClient || !supabaseUserId || pairingRefreshInFlight) {
    return;
  }

  pairingRefreshInFlight = true;

  try {
    const { data: pairings, error } = await supabaseClient
      .from(SUPABASE_PAIRING_TABLE)
      .select("id, requester_id, recipient_id, status, created_at, responded_at")
      .or(`requester_id.eq.${supabaseUserId},recipient_id.eq.${supabaseUserId}`)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const context = createEmptyPairingContext();
    const activePairings = Array.isArray(pairings) ? pairings : [];

    context.accepted = activePairings.find((pairing) => pairing.status === "accepted") || null;
    context.incoming =
      activePairings.find((pairing) => pairing.status === "pending" && pairing.recipient_id === supabaseUserId) || null;
    context.outgoing =
      activePairings.find((pairing) => pairing.status === "pending" && pairing.requester_id === supabaseUserId) || null;

    const profileIds = [
      supabaseUserId,
      ...activePairings.map((pairing) => getOtherPairingUserId(pairing)).filter(Boolean),
    ];
    context.profiles = await loadPlannerProfiles([...new Set(profileIds)]);
    pairingContext = context;

    if (!context.accepted && plannerViewMode === "partner") {
      const visibleListSetId = getVisibleListSetId();
      plannerViewMode = "self";
      state = selfState;
      setPlannerStateListSet(state, visibleListSetId);
      partnerState = null;
    }

    if (context.accepted) {
      await loadPartnerPlannerState({ silent: true });
    } else {
      partnerState = null;
    }

    renderPairingControls();
    renderPlannerOwnerSwitcher();
    renderSaveStatus();
  } catch (error) {
    if (!silent) {
      setPairingMessage(formatSupabaseError(error), true);
    }
  } finally {
    pairingRefreshInFlight = false;
  }
}

async function loadPlannerProfiles(ownerIds) {
  if (!ownerIds.length) {
    return {};
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_PROFILE_TABLE)
    .select("owner_id, email")
    .in("owner_id", ownerIds);

  if (error) {
    throw error;
  }

  return Object.fromEntries((data || []).map((profile) => [profile.owner_id, profile]));
}

async function loadPartnerPlannerState({ silent = false } = {}) {
  const acceptedPairing = getAcceptedPairing();
  const partnerUserId = acceptedPairing ? getOtherPairingUserId(acceptedPairing) : "";

  if (!partnerUserId) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_STATE_TABLE)
      .select("data")
      .eq("owner_id", partnerUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const visibleListSetId = getVisibleListSetId();
    partnerState = data?.data ? normalizeStateData(data.data) : createPartnerFallbackState();
    setPlannerStateListSet(partnerState, visibleListSetId);

    if (plannerViewMode === "partner") {
      state = partnerState;
      setPlannerStateListSet(state, visibleListSetId);
      hydrateSettingsUI();
      renderAll();
    }
  } catch (error) {
    if (!silent) {
      setPairingMessage(formatSupabaseError(error), true);
    }
  }
}

function createPartnerFallbackState() {
  return {
    ...structuredClone(defaultState),
    activeListSet: getVisibleListSetId(),
  };
}

function getOtherPairingUserId(pairing) {
  if (!pairing) {
    return "";
  }

  return pairing.requester_id === supabaseUserId ? pairing.recipient_id : pairing.requester_id;
}

function getPairingOtherEmail(pairing) {
  const otherUserId = getOtherPairingUserId(pairing);
  return pairingContext.profiles[otherUserId]?.email || "partner";
}

function getPairingDisplayName(pairing) {
  const preferredName = normalizePairedDisplayName(selfState?.settings?.pairedAccountDisplayName);

  if (preferredName) {
    return preferredName;
  }

  const email = getPairingOtherEmail(pairing);
  const fallbackName = email.includes("@") ? email.split("@")[0] : email || "Partner";
  return normalizePairedDisplayName(fallbackName) || "Partner";
}

function togglePairedNameEditor() {
  if (els.pairedNameEditor.hidden) {
    showPairedNameEditor();
    return;
  }

  hidePairedNameEditor();
}

function showPairedNameEditor() {
  const acceptedPairing = getAcceptedPairing();

  if (!acceptedPairing) {
    return;
  }

  els.pairedDisplayName.value = getPairingDisplayName(acceptedPairing);
  els.pairedNameEditor.hidden = false;
  els.pairedNameToggleBtn.textContent = "Done";
  els.pairedNameToggleBtn.setAttribute("aria-expanded", "true");
  els.pairedDisplayName.focus();
  els.pairedDisplayName.select();
}

function hidePairedNameEditor() {
  els.pairedNameEditor.hidden = true;
  els.pairedNameToggleBtn.textContent = "Change name";
  els.pairedNameToggleBtn.setAttribute("aria-expanded", "false");
}

function handlePairedDisplayNameInput() {
  const nextName = normalizePairedDisplayName(els.pairedDisplayName.value);

  if (selfState.settings.pairedAccountDisplayName === nextName) {
    return;
  }

  selfState.settings.pairedAccountDisplayName = nextName;
  saveSelfState();
  renderPlannerOwnerSwitcher();
  renderPairingControls();
}

async function handlePairingInviteSubmit(event) {
  event.preventDefault();

  if (!supabaseClient || !supabaseUserId) {
    setPairingMessage("Sign in before pairing.", true);
    return;
  }

  const email = els.pairingEmail.value.trim().toLowerCase();

  if (!email) {
    setPairingMessage("Enter a registered email address.", true);
    return;
  }

  setPairingLoading(true);
  setPairingMessage("Sending invitation...");

  try {
    const { error } = await supabaseClient.rpc("invite_planner_pair", {
      target_email: email,
    });

    if (error) {
      throw error;
    }

    els.pairingEmail.value = "";
    setPairingMessage("Invitation sent.");
    await refreshPairingContext({ silent: true });
  } catch (error) {
    setPairingMessage(formatSupabaseError(error), true);
  } finally {
    setPairingLoading(false);
  }
}

async function respondToIncomingPairing(shouldAccept) {
  const incoming = pairingContext.incoming;

  if (!incoming) {
    return;
  }

  setPairingLoading(true);
  setPairingMessage(shouldAccept ? "Accepting invitation..." : "Declining invitation...");

  try {
    const { error } = await supabaseClient.rpc("respond_planner_pair", {
      pairing_id: incoming.id,
      accept_invite: shouldAccept,
    });

    if (error) {
      throw error;
    }

    setPairingMessage(shouldAccept ? "Pairing accepted." : "Invitation declined.");
    await refreshPairingContext({ silent: true });
  } catch (error) {
    setPairingMessage(formatSupabaseError(error), true);
  } finally {
    setPairingLoading(false);
  }
}

async function cancelOutgoingPairing() {
  const outgoing = pairingContext.outgoing;

  if (!outgoing) {
    return;
  }

  await deletePairing(outgoing.id, "Invitation canceled.");
}

async function removeAcceptedPairing() {
  const acceptedPairing = pairingContext.accepted;

  if (!acceptedPairing) {
    return;
  }

  await deletePairing(acceptedPairing.id, "Pairing removed.");
}

async function deletePairing(pairingId, successMessage) {
  setPairingLoading(true);
  setPairingMessage("Updating pairing...");

  try {
    const { error } = await supabaseClient.rpc("delete_planner_pair", {
      pairing_id: pairingId,
    });

    if (error) {
      throw error;
    }

    if (plannerViewMode === "partner") {
      const visibleListSetId = getVisibleListSetId();
      plannerViewMode = "self";
      state = selfState;
      setPlannerStateListSet(state, visibleListSetId);
      partnerState = null;
      hydrateSettingsUI();
      renderAll();
    }

    setPairingMessage(successMessage);
    await refreshPairingContext({ silent: true });
  } catch (error) {
    setPairingMessage(formatSupabaseError(error), true);
  } finally {
    setPairingLoading(false);
  }
}

function setPairingLoading(isLoading) {
  els.pairingEmail.disabled = isLoading;
  els.pairingInviteBtn.disabled = isLoading;
  els.pairingAcceptBtn.disabled = isLoading;
  els.pairingDeclineBtn.disabled = isLoading;
  els.pairingCancelBtn.disabled = isLoading;
  els.pairingRemoveBtn.disabled = isLoading;
  els.pairedNameToggleBtn.disabled = isLoading;
  els.pairedDisplayName.disabled = isLoading;
}

function setPairingMessage(message, isError = false) {
  els.pairingMessage.textContent = message;
  els.pairingMessage.classList.toggle("error", isError);
}

function renderPairingControls() {
  const acceptedPairing = pairingContext.accepted;
  const incoming = pairingContext.incoming;
  const outgoing = pairingContext.outgoing;

  els.pairingForm.hidden = Boolean(acceptedPairing || incoming || outgoing);
  els.pairingIncoming.hidden = !incoming;
  els.pairingOutgoing.hidden = !outgoing;
  els.pairingConnected.hidden = !acceptedPairing;

  if (!acceptedPairing) {
    hidePairedNameEditor();
  }

  if (incoming) {
    els.pairingIncomingCopy.textContent = `${getPairingOtherEmail(incoming)} invited you to pair planners.`;
  }

  if (outgoing) {
    els.pairingOutgoingCopy.textContent = `Waiting for ${getPairingOtherEmail(outgoing)} to respond.`;
  }

  if (acceptedPairing) {
    els.pairingConnectedCopy.textContent = `Paired with ${getPairingDisplayName(acceptedPairing)}.`;
  }
}

async function loadSupabaseState() {
  const { data, error } = await supabaseClient
    .from(SUPABASE_STATE_TABLE)
    .select("data")
    .eq("owner_id", supabaseUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.data ? normalizeStateData(data.data) : null;
}

function hydrateStateUIAfterRemoteLoad() {
  hydrateSettingsUI();
  updateRecurringShowDaysVisibility();
  renderAll();
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setAuthMessage("Supabase is still connecting. Try again in a moment.", true);
    return;
  }

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const confirmPassword = els.authConfirmPassword.value;

  if (!email || !password) {
    setAuthMessage("Enter your email and password.", true);
    return;
  }

  if (authMode === "sign-up" && password !== confirmPassword) {
    setAuthMessage("Passwords do not match.", true);
    return;
  }

  setAuthLoading(true);
  setAuthMessage(authMode === "sign-up" ? "Creating account..." : "Signing in...");

  try {
    const authResult =
      authMode === "sign-up"
        ? await supabaseClient.auth.signUp({ email, password })
        : await supabaseClient.auth.signInWithPassword({ email, password });

    if (authResult.error) {
      throw authResult.error;
    }

    if (authMode === "sign-up" && authResult.data.user && Array.isArray(authResult.data.user.identities)) {
      if (authResult.data.user.identities.length === 0) {
        setAuthMessage("Could not create account. Email already registered.", true);
        return;
      }
    }

    if (!authResult.data.session?.user) {
      setAuthMessage(authMode === "sign-up" ? "Confirm your email to create your account." : "Check your email, then sign in.");
      return;
    }

    await loadAuthenticatedPlanner(authResult.data.session.user);
  } catch (error) {
    setAuthMessage(formatAuthError(error), true);
  } finally {
    setAuthLoading(false);
  }
}

async function handlePasswordChangeSubmit(event) {
  event.preventDefault();

  if (els.passwordFields.hidden) {
    showPasswordFields();
    return;
  }

  if (!supabaseClient || !supabaseUserId) {
    setPasswordMessage("Sign in before changing your password.", true);
    return;
  }

  const password = els.newPassword.value;
  const confirmation = els.confirmNewPassword.value;

  if (!password || !confirmation) {
    setPasswordMessage("Enter and confirm a new password.", true);
    return;
  }

  if (password.length < 6) {
    setPasswordMessage("Password must be at least 6 characters.", true);
    return;
  }

  if (password !== confirmation) {
    setPasswordMessage("Passwords do not match.", true);
    return;
  }

  setPasswordLoading(true);
  setPasswordMessage("Updating password...");

  try {
    const { error } = await supabaseClient.auth.updateUser({ password });

    if (error) {
      throw error;
    }

    els.newPassword.value = "";
    els.confirmNewPassword.value = "";
    setPasswordMessage("Password updated.");
  } catch (error) {
    setPasswordMessage(formatSupabaseError(error), true);
  } finally {
    setPasswordLoading(false);
  }
}

function showPasswordFields() {
  els.passwordFields.hidden = false;
  els.passwordToggleBtn.hidden = true;
  els.passwordToggleBtn.setAttribute("aria-expanded", "true");
  setPasswordMessage("");
  els.newPassword.focus();
}

function resetPasswordSection() {
  els.passwordFields.hidden = true;
  els.passwordToggleBtn.hidden = false;
  els.passwordToggleBtn.setAttribute("aria-expanded", "false");
  els.newPassword.value = "";
  els.confirmNewPassword.value = "";
  setPasswordLoading(false);
  setPasswordMessage("");
}

function cancelPasswordChange() {
  resetPasswordSection();
  els.passwordToggleBtn.focus();
}

function setPasswordLoading(isLoading) {
  els.newPassword.disabled = isLoading;
  els.confirmNewPassword.disabled = isLoading;
  els.passwordSubmitBtn.disabled = isLoading;
  els.passwordCancelBtn.disabled = isLoading;
}

function setPasswordMessage(message, isError = false) {
  els.passwordMessage.textContent = message;
  els.passwordMessage.classList.toggle("error", isError);
  els.passwordMessage.hidden = !message;
}

function showDeleteAccountConfirm() {
  setDeleteAccountMessage("");
  els.deleteAccountConfirm.hidden = false;
  els.deleteAccountConfirmInput.value = "";
  updateDeleteAccountConfirmState();
  els.deleteAccountConfirmInput.focus();
}

function hideDeleteAccountConfirm({ restoreFocus = true } = {}) {
  els.deleteAccountConfirm.hidden = true;
  els.deleteAccountConfirmInput.value = "";
  updateDeleteAccountConfirmState();

  if (restoreFocus) {
    els.deleteAccountStartBtn.focus();
  }
}

function updateDeleteAccountConfirmState() {
  els.deleteAccountConfirmBtn.disabled = els.deleteAccountConfirmInput.value.trim() !== "DELETE";
}

async function handleDeleteAccountConfirm() {
  if (els.deleteAccountConfirmBtn.disabled) {
    return;
  }

  if (!supabaseClient || !supabaseUserId) {
    setDeleteAccountMessage("Sign in before deleting your account.", true);
    return;
  }

  setDeleteAccountLoading(true);
  setDeleteAccountMessage("Deleting account...");
  const deletedStorageKey = activeStorageKey;
  let didDeleteAccount = false;

  try {
    const { error } = await supabaseClient.rpc("delete_current_planner_account");

    if (error) {
      throw error;
    }

    didDeleteAccount = true;
    clearDeletedAccountLocalState(deletedStorageKey);

    try {
      await supabaseClient.auth.signOut({ scope: "local" });
    } catch {
      // The auth record is already gone; local UI cleanup below is the important part.
    }

    showAuthView("Account deleted.");
  } catch (error) {
    setDeleteAccountMessage(formatSupabaseError(error), true);
  } finally {
    if (!didDeleteAccount) {
      setDeleteAccountLoading(false);
    }
  }
}

function setDeleteAccountLoading(isLoading) {
  els.deleteAccountStartBtn.disabled = isLoading;
  els.deleteAccountConfirmInput.disabled = isLoading;
  els.deleteAccountCancelBtn.disabled = isLoading;
  els.deleteAccountConfirmBtn.disabled = isLoading || els.deleteAccountConfirmInput.value.trim() !== "DELETE";
}

function setDeleteAccountMessage(message, isError = false) {
  els.deleteAccountMessage.textContent = message;
  els.deleteAccountMessage.classList.toggle("error", isError);
}

function clearDeletedAccountLocalState(storageKey) {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(AUTH_MIGRATION_KEY);
  } catch {
    // Local storage cleanup is best effort; Supabase remains the source of truth.
  }
}

async function handleSignOut() {
  if (!supabaseClient) {
    showAuthView();
    return;
  }

  setSupabaseSyncStatus("syncing");

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    showAuthView();
  } catch (error) {
    setSupabaseSyncStatus("error", error);
  }
}

function setAuthMode(nextMode) {
  authMode = nextMode === "sign-up" ? "sign-up" : "sign-in";
  const isSignUp = authMode === "sign-up";

  els.authSignInMode.classList.toggle("active", !isSignUp);
  els.authSignUpMode.classList.toggle("active", isSignUp);
  els.authPassword.autocomplete = isSignUp ? "new-password" : "current-password";
  els.authConfirmPasswordLabel.hidden = !isSignUp;
  els.authConfirmPassword.hidden = !isSignUp;
  els.authConfirmPassword.required = isSignUp;
  if (!isSignUp) {
    els.authConfirmPassword.value = "";
  }
  els.authSubmitBtn.textContent = isSignUp ? "Create account" : "Sign in";
  setAuthMessage("");
}

function setAuthLoading(isLoading) {
  els.authEmail.disabled = isLoading;
  els.authPassword.disabled = isLoading;
  els.authConfirmPassword.disabled = isLoading;
  els.authSubmitBtn.disabled = isLoading;
  els.authSignInMode.disabled = isLoading;
  els.authSignUpMode.disabled = isLoading;
}

function setAuthMessage(message, isError = false) {
  els.authMessage.textContent = message;
  els.authMessage.classList.toggle("error", isError);
}

function showAuthView(message = "", isError = false) {
  supabaseSyncReady = false;
  supabaseSyncPending = false;
  supabaseSyncInFlight = false;
  supabaseUserId = "";
  signedInUserEmail = "";
  activeStorageKey = STORAGE_KEY;
  state = structuredClone(defaultState);
  selfState = state;
  partnerState = null;
  plannerViewMode = "self";
  pairingContext = createEmptyPairingContext();
  closeSettingsModal();
  renderAll();

  els.appHeader.hidden = true;
  els.listsView.hidden = true;
  els.authView.hidden = false;
  els.authUserLabel.textContent = "";
  setSupabaseSyncStatus("local");
  setAuthMessage(message, isError);
}

function showPlannerView() {
  els.authView.hidden = true;
  els.appHeader.hidden = false;
  els.listsView.hidden = false;
  els.authUserLabel.textContent = signedInUserEmail;
  setAuthMessage("");
  renderPlannerOwnerSwitcher();
  renderPairingControls();
}

function isStateNewer(candidateState, currentState) {
  return savedAtToTime(candidateState?.lastSavedAt) > savedAtToTime(currentState?.lastSavedAt);
}

function savedAtToTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function saveState() {
  if (isReadOnlyView()) {
    renderSaveStatus();
    return;
  }

  state.lastSavedAt = new Date().toISOString();
  selfState = state;
  persistLocalState();
  renderSaveStatus();
  queueSupabaseSync();
}

function saveSelfState() {
  selfState.lastSavedAt = new Date().toISOString();

  if (!isReadOnlyView()) {
    state = selfState;
  }

  persistLocalState(activeStorageKey, selfState);
  renderSaveStatus();
  queueSupabaseSync();
}

function ensureSaveStatusTimestamp() {
  if (!state.lastSavedAt) {
    state.lastSavedAt = new Date().toISOString();
    persistLocalState();
  }

  renderSaveStatus();
}

function persistLocalState(storageKey = activeStorageKey, stateToPersist = state) {
  localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
}

function normalizeSavedAt(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function queueSupabaseSync() {
  if (!supabaseSyncReady || !supabaseClient || !supabaseUserId) {
    return;
  }

  supabaseSyncPending = true;
  void flushSupabaseSync();
}

async function flushSupabaseSync() {
  if (supabaseSyncInFlight) {
    return;
  }

  supabaseSyncInFlight = true;

  try {
    while (supabaseSyncPending) {
      supabaseSyncPending = false;
      setSupabaseSyncStatus("syncing");

      const payload = JSON.parse(JSON.stringify(selfState));
      const { error } = await supabaseClient.from(SUPABASE_STATE_TABLE).upsert({
        owner_id: supabaseUserId,
        data: payload,
        updated_at: selfState.lastSavedAt || new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      if (pendingLegacyMigrationUserId === supabaseUserId) {
        localStorage.setItem(AUTH_MIGRATION_KEY, supabaseUserId);
        pendingLegacyMigrationUserId = "";
      }

      setSupabaseSyncStatus("synced");
    }
  } catch (error) {
    setSupabaseSyncStatus("error", error);
  } finally {
    supabaseSyncInFlight = false;

    if (supabaseSyncPending) {
      void flushSupabaseSync();
    }
  }
}

function setSupabaseSyncStatus(status, error = null) {
  supabaseSyncStatus = status;
  supabaseSyncErrorMessage = error ? formatSupabaseError(error) : "";

  if (error) {
    console.warn("Supabase sync failed", error);
  }

  renderSaveStatus();
}

function formatSupabaseError(error) {
  if (!error) {
    return "Unknown error";
  }

  const message =
    error.message ||
    error.error_description ||
    error.error ||
    error.details ||
    error.hint ||
    String(error);

  return String(message).replace(/\s+/g, " ").trim();
}

function formatAuthError(error) {
  const message = formatSupabaseError(error);

  if (authMode === "sign-up" && /already|registered|exists/i.test(message)) {
    return "Could not create account. Email already registered.";
  }

  return message;
}

function renderSaveStatus() {
  const statusState = isReadOnlyView() ? selfState : state;
  const savedAt = new Date(statusState.lastSavedAt || Date.now());
  const savedTime = savedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  els.saveStatus.title = "";

  if (supabaseSyncStatus === "connecting") {
    els.saveStatus.textContent = "Connecting Supabase...";
    return;
  }

  if (supabaseSyncStatus === "syncing") {
    els.saveStatus.textContent = "Syncing to Supabase...";
    return;
  }

  if (supabaseSyncStatus === "synced") {
    els.saveStatus.textContent = `Auto-saved at ${savedTime}`;
    return;
  }

  if (supabaseSyncStatus === "error") {
    els.saveStatus.textContent = `Supabase error: ${supabaseSyncErrorMessage || "check console"}`;
    els.saveStatus.title = `Saved locally at ${savedTime}. ${supabaseSyncErrorMessage || ""}`;
    return;
  }

  els.saveStatus.textContent = `Auto-saved at ${savedTime}`;
}
