// Planner bootstrap, shared state, event wiring, task actions, and animations.
// See README.md for the code map and script-loading contract.

const STORAGE_KEY = "schedms-data-v1";
const SUPABASE_URL = "https://qvovatdgthvolgenmnir.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1Kp-mcwQyvdH6P_VEiyqFA_gFtRsAu3";
const SUPABASE_CLIENT_MODULE_URL = "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_CLIENT_FALLBACK_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SUPABASE_STATE_TABLE = "planner_states";
const SUPABASE_PROFILE_TABLE = "planner_profiles";
const SUPABASE_PAIRING_TABLE = "planner_pairings";
const SUPABASE_SHARED_STATE_TABLE = "planner_shared_states";
const AUTH_MIGRATION_KEY = `${STORAGE_KEY}-auth-migrated-user`;
const LIST_TYPES = ["daily", "weekly", "persistent"];
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
const RJ_LIST_KIND_TODO = "todo";
const RJ_LIST_KIND_SCHEDULE = "schedule";
const ADD_TASK_SYMBOL = "";
const SAVE_TASK_SYMBOL = "✓";
const DEFAULT_TIMEZONE_OFFSET = "-08:00";
const SCHEDMS_WEEKLY_RESET_DAY_UTC = 4;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RECURRING_PANEL_CLOSE_DELAY_MS = 180;
const RECURRING_FORM_MOTION_MS = 260;
const CUSTOM_SELECT_CLOSE_MS = 84;
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

function createDefaultSharedRjState() {
  return {
    lastSavedAt: "",
    periodId: "",
    tasks: {
      todo: [],
      schedule: [],
    },
  };
}

function getActiveListSet() {
  return state.listSets[state.activeListSet];
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
  return false;
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
let rjDragState = {
  owner: null,
  kind: null,
  taskId: null,
  taskGroup: null,
  insertIndex: null,
  listEl: null,
};
let dragAutoScrollState = {
  listType: null,
  frameId: null,
  lastClientY: null,
  speed: 0,
};
let editState = null;
let recurringCreateMode = false;
let recurringFormPinned = false;
let recurringFormCloseTimer = null;
let rjComposerOwner = "mine";
let openRjSchedulePanel = null;
let rjSchedulePanelCloseTimer = null;
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
let sharedRjState = createDefaultSharedRjState();
let sharedRjPairingId = "";
let sharedRjSyncPending = false;
let sharedRjSyncInFlight = false;
let sharedRjRemoteAvailable = true;
let sharedRjRemoteNotice = "";
let pairingContext = {
  accepted: null,
  incoming: null,
  outgoing: null,
  profiles: {},
};
let pairingRefreshInFlight = false;
const pendingAppendAnimations = new Set();

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
  persistentListTitle: document.getElementById("persistent-list-title"),
  partnerRjCard: document.getElementById("partner-rj-card"),
  partnerRjTitle: document.getElementById("partner-rj-title"),
  partnerRjList: document.getElementById("partner-rj-list"),
  partnerRjEmpty: document.getElementById("partner-rj-empty"),
  partnerRecurringPanel: document.getElementById("partner-recurring-panel"),
  partnerRecurringPanelCount: document.getElementById("partner-recurring-panel-count"),
  partnerRecurringPanelList: document.getElementById("partner-recurring-panel-list"),
  partnerRecurringPanelEmpty: document.getElementById("partner-recurring-panel-empty"),
  rjComposer: document.getElementById("rj-composer"),
  rjTargetButtons: document.querySelectorAll(".rj-target-btn"),
  rjOwnerToggle: document.getElementById("rj-owner-toggle"),
  rjOnlyElements: document.querySelectorAll(".rj-only"),
  mineRjScheduleCard: document.getElementById("mine-rj-schedule-card"),
  mineRjScheduleList: document.getElementById("mine-rj-schedule-list"),
  mineRjScheduleEmpty: document.getElementById("mine-rj-schedule-empty"),
  sharedRjTodoCard: document.getElementById("shared-rj-todo-card"),
  sharedRjTodoList: document.getElementById("shared-rj-todo-list"),
  sharedRjTodoEmpty: document.getElementById("shared-rj-todo-empty"),
  sharedRjScheduleCard: document.getElementById("shared-rj-schedule-card"),
  sharedRjScheduleList: document.getElementById("shared-rj-schedule-list"),
  sharedRjScheduleEmpty: document.getElementById("shared-rj-schedule-empty"),
  sharedRjColumnHeader: document.getElementById("shared-rj-column-header"),
  partnerRjColumnHeader: document.getElementById("partner-rj-column-header"),
  partnerRjColumnTitle: document.getElementById("partner-rj-column-title"),
  sharedRecurringPanel: document.getElementById("shared-recurring-panel"),
  sharedRecurringPanelCount: document.getElementById("shared-recurring-panel-count"),
  sharedRecurringPanelList: document.getElementById("shared-recurring-panel-list"),
  sharedRecurringPanelEmpty: document.getElementById("shared-recurring-panel-empty"),
  partnerRjScheduleCard: document.getElementById("partner-rj-schedule-card"),
  partnerRjScheduleTitle: document.getElementById("partner-rj-schedule-title"),
  partnerRjScheduleList: document.getElementById("partner-rj-schedule-list"),
  partnerRjScheduleEmpty: document.getElementById("partner-rj-schedule-empty"),
  mineMsTitle: document.getElementById("mine-ms-title"),
  partnerMsSection: document.getElementById("partner-ms-section"),
  partnerMsTitle: document.getElementById("partner-ms-title"),
  partnerMsLists: {
    daily: {
      list: document.getElementById("partner-ms-daily-list"),
      empty: document.getElementById("partner-ms-daily-empty"),
    },
    weekly: {
      list: document.getElementById("partner-ms-weekly-list"),
      empty: document.getElementById("partner-ms-weekly-empty"),
    },
    persistent: {
      list: document.getElementById("partner-ms-persistent-list"),
      empty: document.getElementById("partner-ms-persistent-empty"),
    },
  },
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
  rjSchedulePanels: document.querySelectorAll(".rj-schedule-panel"),
  listSetButtons: document.querySelectorAll(".list-set-switch"),
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

    if (event.key === "Escape" && editState) {
      cancelTaskEdit();
    }

    if (event.key === "Escape" && openRjSchedulePanel) {
      closeRjSchedulePanel();
    }
  });

  els.listSetButtons.forEach((button) => {
    button.addEventListener("click", () => switchListSet(button.dataset.listSet));
  });

  els.recurringToggleBtn.addEventListener("click", toggleRecurringFormPin);
  els.rjOwnerToggle.addEventListener("click", toggleRjComposerOwner);
  els.recurringInterval.addEventListener("change", handleRecurringIntervalChange);
  els.recurringShowDays.addEventListener("change", handleRecurringShowDayChange);
  wireRjSchedulePanels();

  els.addForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      handleTaskFormSubmit(form, event.submitter);
    });
  });

  els.schedmsAddForm.addEventListener("submit", handleSchedmsAddSubmit);
  document.addEventListener("click", handleTaskEditOutsideClick);

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
  void menu.offsetHeight;
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
    priority: false,
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

function normalizeSchedmsTargetList(listType) {
  return LIST_TYPES.includes(listType) ? listType : "daily";
}

function setSchedmsAddError(message) {
  els.schedmsAddError.textContent = message;
}

function playTaskCompleteSound(isPriority = false) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  completionAudioContext ||= new AudioContextConstructor();

  if (completionAudioContext.state === "suspended") {
    completionAudioContext.resume().catch(() => {});
  }

  if (isPriority) {
    playPriorityAchievementSound(completionAudioContext);
    return;
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

function playPriorityAchievementSound(audioContext) {
  const startTime = audioContext.currentTime + 0.01;
  const notes = [
    { frequency: 783.99, offset: 0, gain: 0.036, duration: 0.09 },
    { frequency: 987.77, offset: 0.045, gain: 0.034, duration: 0.11 },
    { frequency: 1174.66, offset: 0.105, gain: 0.03, duration: 0.13 },
    { frequency: 1567.98, offset: 0.19, gain: 0.024, duration: 0.22 },
    { frequency: 1975.53, offset: 0.205, gain: 0.012, duration: 0.18 },
  ];

  notes.forEach((note) => {
    playCompletionTone(audioContext, startTime + note.offset, note.frequency, note.gain, note.duration);
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

function handleTaskFormSubmit(form, submitter = null) {
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
    updateEditedTask(listType, text, isTaskOptionsSubmit, submitter?.dataset?.rjKind);
    return;
  }

  if (state.activeListSet === "rj" && listType === "persistent") {
    addNewRjItem(
      text,
      rjComposerOwner,
      submitter?.dataset?.rjKind || RJ_LIST_KIND_TODO
    );
    return;
  }

  addNewTask(listType, text, isTaskOptionsSubmit);
}

function addNewRjItem(text, owner, kind) {
  const normalizedOwner = owner === "shared" ? "shared" : "mine";
  const normalizedKind = kind === RJ_LIST_KIND_SCHEDULE ? RJ_LIST_KIND_SCHEDULE : RJ_LIST_KIND_TODO;

  if (normalizedOwner === "shared" && !getAcceptedPairing()) {
    setFormError("persistent", "Pair with another user before adding shared items.");
    return;
  }

  const taskId = crypto.randomUUID();
  const task = createRjListTask(taskId, text, normalizedKind);

  if (normalizedOwner === "shared") {
    sharedRjState.tasks[normalizedKind].push(task);
    saveSharedRjState();
  } else {
    state.listSets.rj.tasks.persistent.push(task);
    saveState();
  }

  pendingAppendAnimations.add(taskId);
  window.setTimeout(() => pendingAppendAnimations.delete(taskId), 500);
  getTaskInput("persistent").value = "";
  resetRecurringShowDayControls();
  closeRecurringForm({ immediate: true });
  setFormError("persistent", "");
  renderAll();
  getTaskInput("persistent").focus();
}

function createRjListTask(taskId, text, kind) {
  if (recurringCreateMode || kind === RJ_LIST_KIND_SCHEDULE) {
    const task = recurringCreateMode
      ? createRjTaskFromOptions(taskId, text)
      : {
          id: taskId,
          text,
          done: false,
          priority: false,
        };
    task.irlKind = kind;
    return task;
  }

  return {
    id: taskId,
    text,
    done: false,
    priority: false,
    irlKind: RJ_LIST_KIND_TODO,
  };
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
      priority: false,
    });
  }

  pendingAppendAnimations.add(taskId);
  window.setTimeout(() => pendingAppendAnimations.delete(taskId), 500);

  getTaskInput(listType).value = "";
  resetRecurringShowDayControls();
  closeRecurringForm({ immediate: true });
  saveState();
  renderAll();
}

function createRjTaskFromOptions(taskId, text) {
  const task = {
    id: taskId,
    text,
    done: false,
    priority: false,
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
  cancelTaskEdit();
  state.activeListSet = nextListSetId;
  if (!isReadOnlyView()) {
    runTimedUpdatesIfNeeded();
    saveState();
  }
  renderAll();
}

function openSettingsModal() {
  hydrateSettingsUI();
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
  hidePairedNameEditor();
  resetPasswordSection();
  hideDeleteAccountConfirm({ restoreFocus: false });
  els.settingsOpenBtn.focus();
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
  recurringFormPinned = false;
  setRecurringCreateMode(false);

  if (immediate) {
    window.clearTimeout(recurringFormCloseTimer);
    recurringFormCloseTimer = null;
    els.recurringForm.hidden = true;
  }
}

function openRecurringFormPopover() {
  if (!isReadOnlyView()) {
    setRecurringCreateMode(true);
  }
}

function toggleRecurringFormPin() {
  if (isReadOnlyView()) {
    return;
  }

  recurringFormPinned = !recurringFormPinned;

  if (recurringFormPinned) {
    openRecurringFormPopover();
  } else {
    closeRecurringForm({ immediate: true });
  }
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

function wireRjSchedulePanels() {
  els.rjSchedulePanels.forEach((panel) => {
    const toggle = panel.querySelector(".recurring-panel-toggle");

    toggle.addEventListener("click", () => {
      setRjSchedulePanelOpen(panel, openRjSchedulePanel !== panel);
    });
    panel.addEventListener("pointerenter", cancelRjSchedulePanelClose);
    panel.addEventListener("pointerleave", () => scheduleRjSchedulePanelClose(panel));
    panel.addEventListener("focusin", cancelRjSchedulePanelClose);
    panel.addEventListener("focusout", (event) => {
      if (!event.relatedTarget || !panel.contains(event.relatedTarget)) {
        scheduleRjSchedulePanelClose(panel);
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (openRjSchedulePanel && !openRjSchedulePanel.contains(event.target)) {
      closeRjSchedulePanel();
    }
  });
}

function setRjSchedulePanelOpen(panel, isOpen) {
  cancelRjSchedulePanelClose();

  if (openRjSchedulePanel && openRjSchedulePanel !== panel) {
    updateRjSchedulePanelOpenState(openRjSchedulePanel, false);
  }

  updateRjSchedulePanelOpenState(panel, isOpen);
  openRjSchedulePanel = isOpen ? panel : null;
}

function updateRjSchedulePanelOpenState(panel, isOpen) {
  const toggle = panel.querySelector(".recurring-panel-toggle");
  const content = panel.querySelector(".recurring-panel-content");

  panel.classList.toggle("open", isOpen);
  toggle.setAttribute("aria-expanded", String(isOpen));
  content.hidden = !isOpen;
}

function scheduleRjSchedulePanelClose(panel) {
  cancelRjSchedulePanelClose();
  rjSchedulePanelCloseTimer = window.setTimeout(() => {
    rjSchedulePanelCloseTimer = null;

    if (!panel.matches(":hover")) {
      setRjSchedulePanelOpen(panel, false);
    }
  }, RECURRING_PANEL_CLOSE_DELAY_MS);
}

function cancelRjSchedulePanelClose() {
  if (rjSchedulePanelCloseTimer === null) {
    return;
  }

  window.clearTimeout(rjSchedulePanelCloseTimer);
  rjSchedulePanelCloseTimer = null;
}

function closeRjSchedulePanel() {
  cancelRjSchedulePanelClose();

  if (openRjSchedulePanel) {
    updateRjSchedulePanelOpenState(openRjSchedulePanel, false);
    openRjSchedulePanel = null;
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

function createRecurringKindLabel(task) {
  const isSchedule = isRjScheduleTask(task);
  const label = document.createElement("span");
  label.className = `recurring-kind-label ${isSchedule ? "schedule" : "todo"}`;
  label.textContent = isSchedule ? "\u25f7" : "\u2713";
  label.setAttribute("aria-label", isSchedule ? "Event" : "To-do");
  label.title = isSchedule ? "Event" : "To-do";
  return label;
}

function createScheduledPanelStatus(task) {
  if (!shouldShowScheduledPanelStatusBadge(task)) {
    return null;
  }

  const status = document.createElement("span");
  status.className = `recurring-summary-status ${task.done ? "done" : ""} ${
    doesScheduledTaskShowToday(task) ? "active" : ""
  }`;
  status.textContent = formatScheduledPanelStatus(task);
  return status;
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

function updateRjTargetButtons() {
  const isEditing = els.rjComposer.querySelector(".rj-composer-form")?.classList.contains("editing-task");
  const hasPairing = Boolean(getAcceptedPairing());

  if (!hasPairing) {
    rjComposerOwner = "mine";
  }

  els.rjTargetButtons.forEach((button) => {
    button.hidden = false;
    button.disabled = false;
    const kindLabel = button.dataset.rjKind === RJ_LIST_KIND_SCHEDULE ? "schedule" : "to-do list";
    const ownerLabel = rjComposerOwner === "shared" ? "shared" : "my";
    const actionLabel = `${isEditing ? "Save to" : "Add to"} ${ownerLabel} ${kindLabel}`;
    button.setAttribute("aria-label", actionLabel);
    button.title = actionLabel;
  });

  const isShared = rjComposerOwner === "shared";
  els.rjOwnerToggle.hidden = false;
  els.rjOwnerToggle.disabled = !hasPairing;
  els.rjOwnerToggle.classList.toggle("shared", isShared);
  els.rjOwnerToggle.setAttribute("aria-checked", String(isShared));
  els.rjOwnerToggle.setAttribute(
    "aria-label",
    hasPairing ? `Add items to ${isShared ? "shared" : "my"} lists` : "Pair an account to use shared lists"
  );
  els.rjOwnerToggle.title = hasPairing
    ? `Adding to ${isShared ? "shared" : "my"} lists`
    : "Pair an account to use shared lists";
}

function toggleRjComposerOwner() {
  if (!getAcceptedPairing() || els.rjOwnerToggle.disabled) {
    return;
  }

  rjComposerOwner = rjComposerOwner === "shared" ? "mine" : "shared";
  setFormError("persistent", "");
  updateRjTargetButtons();
}

function isRjScheduleTask(task) {
  const explicitKind = normalizeRjListKind(task?.irlKind);

  if (explicitKind) {
    return explicitKind === RJ_LIST_KIND_SCHEDULE;
  }

  return isRecurringTask(task) || isScheduledOneTimeTask(task);
}

function isRjTodoTask(task) {
  return !isRjScheduleTask(task);
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

  [sharedRjState.tasks.todo, sharedRjState.tasks.schedule].forEach((tasks) => {
    tasks.forEach((task) => {
      maxOrder = Math.max(maxOrder, normalizeCompletionOrder(task?.completedOrder) ?? 0);
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

function runTaskEditAnimation(itemEl, listType, task, onDone, editContext = {}) {
  const targetInput = getTaskInput(listType);
  const sourceCopy = itemEl.querySelector(".task-copy");
  const formEl = getTaskEditForm(listType);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !targetInput || !sourceCopy) {
    prepareTaskEditMode(listType, task, editContext);
    renderAll();
    onDone();
    return;
  }

  let finished = false;
  if (formEl.style.display === "none") {
    formEl.style.display = "";
  }

  const sourceRect = itemEl.getBoundingClientRect();
  const sourceCopyRect = sourceCopy.getBoundingClientRect();
  const itemStyles = window.getComputedStyle(itemEl);
  const copyStyles = window.getComputedStyle(sourceCopy);

  formEl.classList.add("edit-morphing");
  prepareTaskEditMode(listType, task, editContext);
  targetInput.classList.add("edit-morph-target");

  const finalTargetRect = targetInput.getBoundingClientRect();

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
  const didResetShared = resetSharedRjDayIfNeeded();
  const didResetPartner = partnerState ? resetRjDay(partnerState.listSets.rj, dailyPeriodId(new Date())) : false;

  return didReset || didRefreshRecurring || didResetShared || didResetPartner;
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

    if (listSetId === "rj") {
      didReset = resetRjDay(targetListSet, nextPersistentPeriodId) || didReset;
      return;
    }

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

// Keep recurrence definitions and items scheduled for the new day or later.
// Everything belonging to the ending day expires, regardless of completion.
function clearExpiredRjItems(tasks, todayId) {
  return tasks.filter((task) => isRecurringTask(task) || normalizeDateId(task.showOnDate) >= todayId)
    .map((task) => {
      if (!isRecurringTask(task)) return task;
      const refreshed = { ...task, done: false, lastCompletedDate: "", lastRestoredDate: "" };
      delete refreshed.completedOrder;
      return refreshed;
    });
}

function resetRjDay(listSet, todayId) {
  const previousId = listSet.periodIds.persistent;
  if (previousId === todayId) return false;
  if (previousId) {
    Object.keys(listSet.tasks).forEach((kind) => {
      listSet.tasks[kind] = clearExpiredRjItems(listSet.tasks[kind], todayId);
    });
  }
  listSet.periodIds.persistent = todayId;
  return true;
}

function resetSharedRjDayIfNeeded() {
  if (!getAcceptedPairing() || !sharedRjPairingId) return false;
  const todayId = dailyPeriodId(new Date());
  const previousId = sharedRjState.periodId || (sharedRjState.lastSavedAt
    ? dailyPeriodId(new Date(sharedRjState.lastSavedAt)) : "");
  if (previousId === todayId && sharedRjState.periodId) return false;
  if (previousId && previousId !== todayId) {
    Object.keys(sharedRjState.tasks).forEach((kind) => {
      sharedRjState.tasks[kind] = clearExpiredRjItems(sharedRjState.tasks[kind], todayId);
    });
  }
  sharedRjState.periodId = todayId;
  saveSharedRjState();
  return true;
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
        priority: Boolean(task?.priority),
      };
      const irlKind = normalizeRjListKind(task?.irlKind);
      const completedOrder = normalizeCompletionOrder(task?.completedOrder);
      const showOnDate = normalizeDateId(task?.showOnDate);

      if (irlKind) {
        normalizedTask.irlKind = irlKind;
      }

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

function normalizeRjListKind(value) {
  if (value === RJ_LIST_KIND_TODO || value === RJ_LIST_KIND_SCHEDULE) {
    return value;
  }

  return "";
}

function normalizeSharedRjState(parsed) {
  const defaults = createDefaultSharedRjState();

  return {
    lastSavedAt: normalizeSavedAt(parsed?.lastSavedAt),
    periodId: normalizeDateId(parsed?.periodId),
    tasks: {
      todo: normalizeTaskSet(parsed?.tasks?.todo || defaults.tasks.todo).map((task) => ({
        ...task,
        irlKind: RJ_LIST_KIND_TODO,
      })),
      schedule: normalizeTaskSet(parsed?.tasks?.schedule || defaults.tasks.schedule).map((task) => ({
        ...task,
        irlKind: RJ_LIST_KIND_SCHEDULE,
      })),
    },
  };
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
