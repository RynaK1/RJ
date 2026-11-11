// List rendering and IRL drag surfaces. Loaded before app.js.

function renderAll() {
  renderActiveLayout();
  renderListSetSwitcher();
  renderPairingControls();

  LIST_TYPES.forEach((listType) => {
    renderList(listType);
  });

  renderMineRjScheduleList();
  renderSharedRjLists();
  renderPartnerRjList();
  renderPartnerMsLists();
  renderRjSchedulePanels();
  renderResetLabels();
}

function renderActiveLayout() {
  const isRjMode = state.activeListSet === "rj";
  const isReadOnly = isReadOnlyView();

  document.body.classList.toggle("rj-mode", isRjMode);
  els.app.classList.toggle("rj-mode", isRjMode);
  els.schedmsQuickAdd.hidden = isReadOnly || isRjMode;
  if (els.schedmsHorizonNav) {
    els.schedmsHorizonNav.hidden = true;
  }
  els.rjComposer.hidden = !isRjMode || isReadOnly;
  els.recurringTools.hidden = !isRjMode;
  els.rjSchedulePanels.forEach((panel) => {
    panel.hidden = !isRjMode;
  });
  els.timezoneOffset.disabled = isReadOnly;
  els.dstAdjustment.disabled = isReadOnly;
  syncCustomSelect(els.timezoneOffset);
  els.recurringToggleBtn.disabled = isReadOnly;
  els.lists.daily.card.hidden = isRjMode;
  els.lists.weekly.card.hidden = isRjMode;
  const hasPairedRjList = isRjMode && Boolean(getAcceptedPairing());
  const hasPairedMsLists = !isRjMode && Boolean(getAcceptedPairing());

  if (
    !hasPairedRjList &&
    openRjSchedulePanel &&
    openRjSchedulePanel.dataset.rjScheduleOwner !== "mine"
  ) {
    closeRjSchedulePanel();
  }

  els.app.classList.toggle("paired-rj", hasPairedRjList);
  els.rjOnlyElements.forEach((element) => {
    element.hidden = !isRjMode;
  });

  if (isRjMode) {
    // 3-card IRL layout
    if (els.mineTodoCard) els.mineTodoCard.hidden = false;
    els.mineRjScheduleCard.hidden = false;
    els.partnerRjCard.hidden = !hasPairedRjList;

    // Legacy cards and old column headers stay hidden in new 3-list IRL design
    els.sharedRjTodoCard.hidden = true;
    els.sharedRjScheduleCard.hidden = true;
    els.partnerRjScheduleCard.hidden = true;
    if (els.sharedRjColumnHeader) els.sharedRjColumnHeader.hidden = true;
    if (els.partnerRjColumnHeader) els.partnerRjColumnHeader.hidden = true;
  } else {
    els.mineRjScheduleCard.hidden = true;
    els.sharedRjTodoCard.hidden = true;
    els.sharedRjScheduleCard.hidden = true;
    els.partnerRjCard.hidden = true;
    els.partnerRjScheduleCard.hidden = true;
  }

  els.mineMsTitle.hidden = !hasPairedMsLists;
  els.partnerMsSection.hidden = !hasPairedMsLists;
  els.persistentListTitle.textContent = isRjMode ? "My Tasks" : "To-Do";
  updateRjTargetButtons();

  if (typeof applyThemeColors === "function") {
    applyThemeColors();
  }

  if (!isRjMode) {
    closeRecurringForm();
    closeRjSchedulePanel();
    renderSchedmsHorizon();
  }
}

function renderSchedmsHorizon() {
  const isRjMode = state.activeListSet === "rj";
  if (isRjMode) return;

  const cadence = state.activeMsCadence || "all";
  const hasPairing = Boolean(getAcceptedPairing());

  document.querySelectorAll(".schedms-horizon-tab").forEach((tab) => {
    const isActive = tab.dataset.msCadence === cadence;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  if (cadence !== "all" && els.schedmsTargetList) {
    els.schedmsTargetList.value = cadence;
    syncCustomSelect(els.schedmsTargetList);
  }

  if (els.schedmsInput) {
    const placeholders = {
      daily: "Add daily task",
      weekly: "Add weekly task",
      persistent: "Add to-do task",
      all: "Add task",
    };
    els.schedmsInput.placeholder = placeholders[cadence] || "Add task";
  }

  els.lists.daily.card.hidden = cadence !== "daily" && cadence !== "all";
  els.lists.weekly.card.hidden = cadence !== "weekly" && cadence !== "all";
  els.lists.persistent.card.hidden = cadence !== "persistent" && cadence !== "all";
  els.lists.daily.card?.closest(".list-stack")?.classList.toggle("show-all-cadences", cadence === "all");

  if (hasPairing && els.partnerMsLists) {
    const pDaily = els.partnerMsLists.daily.list?.closest(".todo-card");
    const pWeekly = els.partnerMsLists.weekly.list?.closest(".todo-card");
    const pPersistent = els.partnerMsLists.persistent.list?.closest(".todo-card");
    if (pDaily) pDaily.hidden = cadence !== "daily" && cadence !== "all";
    if (pWeekly) pWeekly.hidden = cadence !== "weekly" && cadence !== "all";
    if (pPersistent) pPersistent.hidden = cadence !== "persistent" && cadence !== "all";
    els.partnerMsLists.daily.list?.closest(".partner-ms-list-stack")?.classList.toggle("show-all-cadences", cadence === "all");
  }
}

function renderListSetSwitcher() {
  els.listSetButtons.forEach((button) => {
    const isActive = button.dataset.listSet === state.activeListSet;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function formatTaskDateChipText(dateId) {
  if (!dateId) return "";
  const todayId = dailyPeriodId(new Date());
  const tomorrowId = addCalendarDaysToDateId(todayId, 1);
  if (dateId === todayId) return "Today";
  if (dateId === tomorrowId) return "Tomorrow";

  const [year, month, day] = dateId.split("-").map(Number);
  if (!year || !month || !day) return dateId;
  const d = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function renderMineRjScheduleList() {
  if (state.activeListSet !== "rj") {
    return;
  }

  const acceptedPairing = getAcceptedPairing();
  const hasPairing = Boolean(acceptedPairing);

  // 1. My scheduled tasks
  const myTasks = state.listSets.rj.tasks.persistent.filter(isRjScheduleTask).map((t) => {
    t._owner = "mine";
    return t;
  });

  // 2. Shared scheduled tasks
  const sharedTasks = (hasPairing ? (sharedRjState.tasks.schedule || []) : []).map((t) => {
    t._owner = "shared";
    return t;
  });

  // 3. Partner scheduled tasks (read-only)
  const partnerTasks = (hasPairing && partnerState?.listSets?.rj?.tasks?.persistent
    ? partnerState.listSets.rj.tasks.persistent.filter(isRjScheduleTask)
    : []
  ).map((t) => {
    t._owner = "partner";
    return t;
  });

  const allScheduled = [...myTasks, ...sharedTasks, ...partnerTasks];

  // Chronological sort: by date ascending
  allScheduled.sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) {
      return a.done ? 1 : -1;
    }
    const dateA = getTaskAppearanceDateId(a);
    const dateB = getTaskAppearanceDateId(b);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    if (Boolean(a.priority) !== Boolean(b.priority)) {
      return a.priority ? -1 : 1;
    }
    return 0;
  });

  renderInteractiveRjList(
    allScheduled,
    els.mineRjScheduleList,
    els.mineRjScheduleEmpty,
    "mine",
    RJ_LIST_KIND_SCHEDULE
  );
}

function renderSharedRjLists() {
  resetSharedRjDayIfNeeded();
  const shouldShow = state.activeListSet === "rj" && Boolean(getAcceptedPairing());

  if (!shouldShow) {
    if (els.sharedRjTodoList) els.sharedRjTodoList.innerHTML = "";
    if (els.sharedRjScheduleList) els.sharedRjScheduleList.innerHTML = "";
    return;
  }

  // Populate legacy test surfaces to preserve test harness compatibility
  if (els.sharedRjTodoList && els.sharedRjTodoEmpty) {
    renderInteractiveRjList(
      sharedRjState.tasks.todo,
      els.sharedRjTodoList,
      els.sharedRjTodoEmpty,
      "shared",
      RJ_LIST_KIND_TODO
    );
  }
  if (els.sharedRjScheduleList && els.sharedRjScheduleEmpty) {
    renderInteractiveRjList(
      sharedRjState.tasks.schedule,
      els.sharedRjScheduleList,
      els.sharedRjScheduleEmpty,
      "shared",
      RJ_LIST_KIND_SCHEDULE
    );
  }
}

function renderInteractiveRjList(tasks, listEl, emptyEl, owner, kind) {
  const orderedTasks =
    kind === RJ_LIST_KIND_TODO
      ? getVisibleTasksForList("persistent", orderTasksForList("persistent", tasks))
      : tasks;
  listEl.innerHTML = "";
  wireRjListDragSurface(listEl, owner, kind);

  orderedTasks.forEach((task) => {
    const taskOwner = task._owner || owner || "mine";
    const isPartner = taskOwner === "partner";
    const isTaskEditing = isEditingTask("persistent", task.id);
    const item = document.createElement("li");
    item.className = `task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    } ${isPartner ? "partner-task-item" : ""}`;
    item.dataset.taskId = task.id;
    item.dataset.owner = taskOwner;
    item.dataset.recurring = String(isRecurringTask(task));
    item.dataset.taskGroup = getRjTaskGroup(task);
    item.draggable = !task.done && !isTaskEditing && !isPartner;

    if (isTaskEditing) {
      item.classList.add("editing");
    }

    if (pendingAppendAnimations.has(task.id)) {
      item.classList.add("append-enter");
    }

    if (!isPartner) {
      item.addEventListener("dragstart", (event) => {
        if (task.done || isTaskEditing || event.target.closest("button")) {
          event.preventDefault();
          return;
        }

        rjDragState = {
          owner: taskOwner,
          kind,
          taskId: task.id,
          taskGroup: getRjTaskGroup(task),
          insertIndex: null,
          listEl,
        };
        item.classList.add("dragging");
        listEl.classList.add("drag-active");

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", task.id);
        }
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        cleanupRjDragState();
      });
    }

    const label = document.createElement("label");
    label.className = "task-main";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    if (isPartner) {
      checkbox.disabled = true;
      checkbox.setAttribute("aria-label", `${task.text} (read only)`);
    } else {
      checkbox.setAttribute("aria-label", task.text);
    }
    const copy = document.createElement("span");
    copy.className = "task-copy";
    copy.textContent = task.text;
    label.append(checkbox, copy);

    // Badges & Chips
    const acceptedPairing = getAcceptedPairing();
    const hasPairing = Boolean(acceptedPairing);
    const partnerName = getPairingDisplayName(acceptedPairing) || "Partner";

    if (taskOwner === "shared") {
      const sharedBadge = document.createElement("span");
      sharedBadge.className = "task-owner-badge owner-shared";
      sharedBadge.textContent = "\uD83D\uDC65 Shared";
      sharedBadge.title = "Shared with partner";
      label.appendChild(sharedBadge);
    } else if (kind === RJ_LIST_KIND_SCHEDULE && hasPairing) {
      const ownerBadge = document.createElement("span");
      ownerBadge.className = `task-owner-badge owner-${taskOwner}`;
      ownerBadge.textContent = taskOwner === "mine" ? "You" : partnerName;
      label.appendChild(ownerBadge);
    }

    if (kind === RJ_LIST_KIND_SCHEDULE || isRjScheduleTask(task)) {
      const dateId = getTaskAppearanceDateId(task);
      const todayId = dailyPeriodId(new Date());
      const dateChip = document.createElement("span");
      const isPast = dateId && dateId < todayId && !task.done;
      const isToday = dateId === todayId;
      dateChip.className = `task-date-chip ${isPast ? "is-past" : ""} ${isToday ? "is-today" : ""}`;
      dateChip.textContent = formatTaskDateChipText(dateId);
      label.appendChild(dateChip);
    }

    let repeatBadge = null;
    if (isRecurringTask(task)) {
      repeatBadge = document.createElement("span");
      repeatBadge.className = "task-badge";
      repeatBadge.textContent = "\u21bb";
      repeatBadge.setAttribute("aria-label", "Recurring");
      repeatBadge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
    }

    let actions = null;
    let favoriteButton = null;
    let editButton = null;
    let deleteButton = null;
    let partnerFavIndicator = null;

    if (!isPartner) {
      actions = document.createElement("div");
      actions.className = "task-actions";

      favoriteButton = document.createElement("button");
      favoriteButton.type = "button";
      favoriteButton.className = `task-action-btn favorite-btn ${task.priority ? "active is-favorite" : ""}`;
      favoriteButton.setAttribute(
        "aria-label",
        `${task.priority ? "Remove favorite from" : "Mark as favorite"}: ${task.text}`
      );
      favoriteButton.setAttribute("aria-pressed", String(task.priority));
      favoriteButton.title = task.priority ? "Favorited (click to remove)" : "Favorite task";
      favoriteButton.innerHTML = task.priority
        ? `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        : `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

      editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "task-action-btn edit-btn";
      editButton.setAttribute("aria-label", `Edit item: ${task.text}`);
      editButton.title = "Edit item";
      editButton.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

      deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "task-action-btn delete-btn";
      deleteButton.setAttribute("aria-label", `Remove item: ${task.text}`);
      deleteButton.title = "Remove item";
      deleteButton.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

      const actionsToggle = document.createElement("button");
      actionsToggle.type = "button";
      actionsToggle.className = "task-actions-toggle";
      actionsToggle.setAttribute("aria-label", `More options for: ${task.text}`);
      actionsToggle.setAttribute("aria-expanded", "false");
      actionsToggle.title = "More options";
      actionsToggle.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
      actionsToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = !item.classList.contains("actions-open");
        dismissMobileTaskActions(willOpen ? item : null);
        item.classList.toggle("actions-open", willOpen);
        actionsToggle.setAttribute("aria-expanded", String(willOpen));
      });

      actions.append(favoriteButton, editButton, deleteButton, actionsToggle);
    } else if (task.priority) {
      partnerFavIndicator = document.createElement("span");
      partnerFavIndicator.className = "task-favorite-indicator";
      partnerFavIndicator.setAttribute("aria-label", "Favorited task");
      partnerFavIndicator.title = "Favorited task";
      partnerFavIndicator.innerHTML = `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    if (isTaskEditing) {
      checkbox.disabled = true;
      if (actions) {
        actions.querySelectorAll("button").forEach((btn) => (btn.disabled = true));
      }
    }

    let taskActionStarted = false;
    let taskPointerStart = null;
    let priorityToggleStarted = false;

    const persistChange = () => {
      if (taskOwner === "shared") {
        saveSharedRjState();
      } else {
        saveState();
      }
      renderAll();
    };

    const togglePriority = () => {
      if ((favoriteButton && favoriteButton.disabled) || priorityToggleStarted || isPartner) {
        return;
      }

      priorityToggleStarted = true;
      task.priority = !task.priority;
      persistChange();
    };

    const setTaskDone = (nextDone) => {
      if (checkbox.disabled || taskActionStarted || task.done === nextDone || isPartner) {
        checkbox.checked = task.done;
        return;
      }

      taskActionStarted = true;
      if (nextDone) {
        playTaskCompleteSound(task.priority);
      }

      if (taskOwner === "mine") {
        moveTaskAfterDoneChange("persistent", task.id, nextDone);
      } else {
        setTaskCompletionState(task, nextDone);
        updateRecurringTaskCompletionFields(task, nextDone);
      }
      persistChange();
    };

    if (!isPartner) {
      wireMobileTaskGesture(item, checkbox, setTaskDone);

      item.addEventListener("pointerdown", (event) => {
        if (
          event.button !== 0 ||
          checkbox.disabled ||
          event.target.closest(".task-action-btn, .task-priority-btn, .task-actions-toggle")
        ) {
          return;
        }

        taskPointerStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      });

      item.addEventListener("pointerup", (event) => {
        if (
          event.button !== 0 ||
          checkbox.disabled ||
          !taskPointerStart ||
          taskPointerStart.pointerId !== event.pointerId ||
          event.target.closest(".task-action-btn, .task-priority-btn, .task-actions-toggle")
        ) {
          taskPointerStart = null;
          return;
        }

        const movedX = Math.abs(event.clientX - taskPointerStart.x);
        const movedY = Math.abs(event.clientY - taskPointerStart.y);
        taskPointerStart = null;

        if (movedX <= 6 && movedY <= 6) {
          event.preventDefault();
          setTaskDone(!checkbox.checked);
        }
      });

      item.addEventListener("pointercancel", () => {
        taskPointerStart = null;
      });

      checkbox.addEventListener("change", () => {
        setTaskDone(checkbox.checked);
      });

      if (favoriteButton) {
        favoriteButton.addEventListener("click", (event) => {
          event.stopPropagation();
          togglePriority();
        });
      }

      const editTask = () => {
        if (!editButton || editButton.disabled || taskActionStarted) {
          return;
        }

        taskActionStarted = true;
        checkbox.disabled = true;
        if (favoriteButton) favoriteButton.disabled = true;
        editButton.disabled = true;
        if (deleteButton) deleteButton.disabled = true;
        setFormError("persistent", "");
        setRecurringError("");

        runTaskEditAnimation(
          item,
          "persistent",
          task,
          () => {
            if (isEditingTask("persistent", task.id)) {
              focusTaskEditInput("persistent");
            }
          },
          { owner: taskOwner, rjKind: kind }
        );
      };

      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        editTask();
      });

      deleteButton.addEventListener("click", () => {
        if (deleteButton.disabled || taskActionStarted) {
          return;
        }

        taskActionStarted = true;
        if (taskOwner === "mine") {
          if (!removeTaskFromList("persistent", task.id)) {
            return;
          }
        } else {
          const taskCollection =
            (sharedRjState.tasks[kind] || sharedRjState.tasks.todo || tasks);
          const taskIndex = taskCollection.findIndex((candidate) => candidate.id === task.id);
          if (taskIndex >= 0) {
            taskCollection.splice(taskIndex, 1);
          }
          recordTaskDeletion(sharedRjState, task.id);
        }
        pendingAppendAnimations.delete(task.id);
        persistChange();
      });
    }

    item.append(label);
    if (actions) {
      item.appendChild(actions);
    }
    if (partnerFavIndicator) {
      item.appendChild(partnerFavIndicator);
    }
    if (repeatBadge) {
      item.appendChild(repeatBadge);
    }
    listEl.appendChild(item);
  });

  emptyEl.style.display = orderedTasks.length === 0 ? "block" : "none";
}

function wireRjListDragSurface(listEl, owner, kind) {
  listEl.ondragover = (event) => {
    if (!isActiveRjDragSurface(listEl, owner, kind)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    const insertIndex = getRjDropInsertIndex(listEl, event.clientY);
    rjDragState.insertIndex = insertIndex;
    renderRjDropIndicator(listEl, insertIndex);
  };

  listEl.ondrop = (event) => {
    if (!isActiveRjDragSurface(listEl, owner, kind)) {
      return;
    }

    event.preventDefault();
    const insertIndex =
      rjDragState.insertIndex === null ? getRjDropInsertIndex(listEl, event.clientY) : rjDragState.insertIndex;
    const reorderedIds = getRjDraggableItems(listEl).map((item) => item.dataset.taskId);
    reorderedIds.splice(Math.max(0, Math.min(insertIndex, reorderedIds.length)), 0, rjDragState.taskId);
    reorderRjListTasks(owner, kind, reorderedIds);

    if (owner === "shared") {
      saveSharedRjState();
    } else {
      saveState();
    }

    cleanupRjDragState();
    renderAll();
  };

  listEl.ondragleave = (event) => {
    if (!listEl.contains(event.relatedTarget)) {
      clearRjDropIndicators();
    }
  };
}

function isActiveRjDragSurface(listEl, owner, kind) {
  return (
    rjDragState.listEl === listEl &&
    rjDragState.owner === owner &&
    rjDragState.kind === kind &&
    Boolean(rjDragState.taskId)
  );
}

function getRjDraggableItems(listEl) {
  return [...listEl.querySelectorAll(".task-item:not(.dragging):not(.done)")];
}

function getRjDropInsertIndex(listEl, clientY) {
  const taskItems = getRjDraggableItems(listEl);
  let insertIndex = taskItems.findIndex((item) => {
    const rect = item.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });

  if (insertIndex < 0) {
    insertIndex = taskItems.length;
  }

  if (rjDragState.kind !== RJ_LIST_KIND_TODO || !rjDragState.taskGroup) {
    return insertIndex;
  }

  const groupIndex = RJ_TASK_GROUPS.indexOf(rjDragState.taskGroup);
  const start = RJ_TASK_GROUPS.slice(0, Math.max(0, groupIndex)).reduce(
    (count, group) => count + taskItems.filter((item) => item.dataset.taskGroup === group).length,
    0
  );
  const size = taskItems.filter((item) => item.dataset.taskGroup === rjDragState.taskGroup).length;
  return Math.max(start, Math.min(insertIndex, start + size));
}

function renderRjDropIndicator(listEl, insertIndex) {
  const taskItems = getRjDraggableItems(listEl);
  const upperTask = taskItems[insertIndex - 1];
  const lowerTask = taskItems[insertIndex];
  clearRjDropIndicators();
  listEl.classList.add("drag-active");
  listEl.classList.toggle("drop-at-start", insertIndex === 0);

  if (upperTask) {
    upperTask.classList.add("drop-after");
  }

  if (lowerTask && insertIndex !== 0) {
    lowerTask.classList.add("drop-before");
  }
}

function reorderRjListTasks(owner, kind, reorderedIds) {
  const sourceTasks =
    owner === "shared" ? sharedRjState.tasks[kind] : state.listSets.rj.tasks.persistent;
  const draggedGroup = rjDragState.taskGroup;
  const shouldReorder = (task) => {
    const taskKind = isRjScheduleTask(task) ? RJ_LIST_KIND_SCHEDULE : RJ_LIST_KIND_TODO;

    if (taskKind !== kind || task.done) {
      return false;
    }

    if (kind === RJ_LIST_KIND_TODO) {
      return getRjTaskGroup(task) === draggedGroup && isTaskVisibleInList("persistent", task);
    }

    return isTaskVisibleInList("persistent", task);
  };
  const taskById = new Map(sourceTasks.filter(shouldReorder).map((task) => [task.id, task]));
  // To-do drops include other groups; only reorder the dragged group.
  reorderedIds = reorderedIds.filter((taskId) => taskById.has(taskId));
  // A drag may become stale during a reset or sync. Never replace a subset of
  // rows: that can duplicate one task and silently overwrite another.
  if (new Set(reorderedIds).size !== taskById.size || reorderedIds.length !== taskById.size ||
      reorderedIds.some((taskId) => !taskById.has(taskId))) return;
  const orderedTasks = reorderedIds.map((taskId) => taskById.get(taskId));
  let orderedIndex = 0;
  const nextTasks = sourceTasks.map((task) => {
    if (!shouldReorder(task)) {
      return task;
    }

    const replacement = orderedTasks[orderedIndex];
    orderedIndex += 1;
    return replacement || task;
  });

  if (owner === "shared") {
    sharedRjState.tasks[kind] = nextTasks;
  } else {
    state.listSets.rj.tasks.persistent = nextTasks;
  }
}

function clearRjDropIndicators() {
  document.querySelectorAll(".task-item.drop-before, .task-item.drop-after").forEach((item) => {
    item.classList.remove("drop-before", "drop-after");
  });
  document.querySelectorAll(".task-list.drop-at-start, .task-list.drag-active").forEach((list) => {
    list.classList.remove("drop-at-start", "drag-active");
  });
}

function cleanupRjDragState() {
  clearRjDropIndicators();
  rjDragState = {
    owner: null,
    kind: null,
    taskId: null,
    taskGroup: null,
    insertIndex: null,
    listEl: null,
  };
}

function updateRecurringTaskCompletionFields(task, done) {
  if (!isRecurringTask(task)) {
    return;
  }

  const todayId = dailyPeriodId(new Date());
  task.recurringStartDate = normalizeDateId(task.recurringStartDate) || todayId;

  if (done) {
    task.lastCompletedDate = todayId;
    task.nextDueDate = addDaysToDateId(todayId, task.intervalDays);
    delete task.lastRestoredDate;
    return;
  }

  task.lastRestoredDate = todayId;
  task.nextDueDate = addDaysToDateId(todayId, task.intervalDays);
}

function renderPartnerRjList() {
  const acceptedPairing = getAcceptedPairing();
  const shouldShow = state.activeListSet === "rj" && Boolean(acceptedPairing);

  els.partnerRjCard.hidden = !shouldShow;
  els.partnerRjList.innerHTML = "";

  if (!shouldShow) {
    return;
  }

  const partnerName = getPairingDisplayName(acceptedPairing) || "Partner";
  els.partnerRjTitle.textContent = `${partnerName}'s Tasks`;
  els.partnerRjScheduleTitle.textContent = "Schedule";
  els.partnerRjColumnTitle.textContent = partnerName;
  els.partnerRjList.setAttribute("aria-label", `${partnerName}'s task list`);
  els.partnerRjScheduleList.setAttribute("aria-label", `${partnerName}'s schedule`);

  if (partnerState) resetRjDay(partnerState.listSets.rj, dailyPeriodId(new Date()));
  const partnerTasks = (partnerState?.listSets?.rj?.tasks?.persistent || [])
    .filter(isRjTodoTask)
    .map((t) => {
      t._owner = "partner";
      return t;
    });

  // Include shared to-dos in partner list as well
  const sharedTasks = (sharedRjState.tasks.todo || []).map((t) => {
    t._owner = "shared";
    return t;
  });

  const combined = [...partnerTasks, ...sharedTasks];
  const orderedTasks = orderTasksForList("persistent", combined);
  const visibleTasks = getVisibleTasksForList("persistent", orderedTasks);

  visibleTasks.forEach((task) => {
    const taskOwner = task._owner || "partner";
    const isShared = taskOwner === "shared";
    const item = document.createElement("li");
    item.className = `task-item partner-task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    }`;
    item.dataset.taskId = task.id;
    item.dataset.owner = taskOwner;

    let partnerFavIndicator = null;
    if (task.priority) {
      partnerFavIndicator = document.createElement("span");
      partnerFavIndicator.className = "task-favorite-indicator";
      partnerFavIndicator.setAttribute("aria-label", "Favorited task");
      partnerFavIndicator.title = "Favorited task";
      partnerFavIndicator.innerHTML = `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    const label = document.createElement("label");
    label.className = "task-main";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;

    let partnerActionStarted = false;
    const toggleSharedTask = () => {
      if (partnerActionStarted) return;
      partnerActionStarted = true;
      const nextDone = !task.done;
      setTaskCompletionState(task, nextDone);
      updateRecurringTaskCompletionFields(task, nextDone);
      saveSharedRjState();
      renderAll();
    };

    if (isShared) {
      item.style.cursor = "pointer";
      checkbox.setAttribute("aria-label", task.text);
      checkbox.addEventListener("change", () => {
        toggleSharedTask();
      });
      item.addEventListener("click", (event) => {
        if (event.target.closest("label, button, .task-action-btn")) return;
        toggleSharedTask();
      });
    } else {
      checkbox.disabled = true;
      checkbox.setAttribute("aria-label", `${task.text} (read only)`);
    }

    const copy = document.createElement("span");
    copy.className = "task-copy";
    copy.textContent = task.text;
    label.append(checkbox, copy);

    if (isShared) {
      const badge = document.createElement("span");
      badge.className = "task-owner-badge owner-shared";
      badge.textContent = "\uD83D\uDC65 Shared";
      label.appendChild(badge);
    }

    let repeatBadge = null;
    if (isRecurringTask(task)) {
      repeatBadge = document.createElement("span");
      repeatBadge.className = "task-badge";
      repeatBadge.textContent = "\u21bb";
      repeatBadge.setAttribute("aria-label", "Recurring");
      repeatBadge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
    }

    item.append(label);
    if (partnerFavIndicator) {
      item.appendChild(partnerFavIndicator);
    }
    if (repeatBadge) {
      item.appendChild(repeatBadge);
    }
    els.partnerRjList.appendChild(item);
  });

  els.partnerRjEmpty.hidden = visibleTasks.length > 0;
  renderReadOnlyRjScheduleList((partnerState?.listSets?.rj?.tasks?.persistent || []).filter(isRjScheduleTask));
}

function renderReadOnlyRjScheduleList(tasks) {
  const orderedTasks = getVisibleTasksForList("persistent", orderTasksByDone(tasks));
  els.partnerRjScheduleList.innerHTML = "";

  orderedTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item partner-task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    }`;

    let partnerFavIndicator = null;
    if (task.priority) {
      partnerFavIndicator = document.createElement("span");
      partnerFavIndicator.className = "task-favorite-indicator";
      partnerFavIndicator.setAttribute("aria-label", "Favorited task");
      partnerFavIndicator.title = "Favorited task";
      partnerFavIndicator.innerHTML = `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    const label = document.createElement("label");
    label.className = "task-main";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.disabled = true;
    checkbox.setAttribute("aria-label", `${task.text} (read only)`);
    const copy = document.createElement("span");
    copy.className = "task-copy";
    copy.textContent = task.text;
    label.append(checkbox, copy);

    let repeatBadge = null;
    if (isRecurringTask(task)) {
      repeatBadge = document.createElement("span");
      repeatBadge.className = "task-badge";
      repeatBadge.textContent = "\u21bb";
      repeatBadge.setAttribute("aria-label", "Recurring");
      repeatBadge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
    }

    item.append(label);
    if (partnerFavIndicator) {
      item.appendChild(partnerFavIndicator);
    }
    if (repeatBadge) {
      item.appendChild(repeatBadge);
    }
    els.partnerRjScheduleList.appendChild(item);
  });

  els.partnerRjScheduleEmpty.style.display = orderedTasks.length === 0 ? "block" : "none";
}

function renderPartnerRecurringPanel(tasks) {
  const scheduledTasks = getScheduledPanelTasks(tasks);
  els.partnerRecurringPanelCount.textContent = String(scheduledTasks.length);
  els.partnerRecurringPanelList.innerHTML = "";

  scheduledTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `recurring-summary-item ${task.done ? "done" : ""} ${
      doesScheduledTaskShowToday(task) ? "is-active" : ""
    }`;
    const kindLabel = createRecurringKindLabel(task);
    const copy = document.createElement("div");
    copy.className = "recurring-summary-copy";
    const title = document.createElement("span");
    title.className = "recurring-summary-title";
    title.textContent = task.text;
    const meta = document.createElement("span");
    meta.className = "recurring-summary-meta";
    meta.textContent = formatScheduledPanelMeta(task);
    const status = createScheduledPanelStatus(task);
    copy.append(title, meta);
    item.append(kindLabel, copy);

    if (status) {
      item.appendChild(status);
    }
    els.partnerRecurringPanelList.appendChild(item);
  });

  els.partnerRecurringPanelEmpty.hidden = scheduledTasks.length > 0;
}

function renderSharedRecurringPanel(tasks) {
  const scheduledTasks = getScheduledPanelTasks(tasks);
  els.sharedRecurringPanelCount.textContent = String(scheduledTasks.length);
  els.sharedRecurringPanelList.innerHTML = "";

  scheduledTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `recurring-summary-item ${task.done ? "done" : ""} ${
      doesScheduledTaskShowToday(task) ? "is-active" : ""
    }`;
    const kindLabel = createRecurringKindLabel(task);
    const copy = document.createElement("div");
    copy.className = "recurring-summary-copy";
    const title = document.createElement("span");
    title.className = "recurring-summary-title";
    title.textContent = task.text;
    const meta = document.createElement("span");
    meta.className = "recurring-summary-meta";
    meta.textContent = formatScheduledPanelMeta(task);
    const status = createScheduledPanelStatus(task);
    copy.append(title, meta);
    item.append(kindLabel, copy);

    if (status) {
      item.appendChild(status);
    }
    els.sharedRecurringPanelList.appendChild(item);
  });

  els.sharedRecurringPanelEmpty.hidden = scheduledTasks.length > 0;
}

function renderPartnerMsLists() {
  const acceptedPairing = getAcceptedPairing();
  const shouldShow = state.activeListSet === "schedms" && Boolean(acceptedPairing);

  els.partnerMsSection.hidden = !shouldShow;
  els.mineMsTitle.hidden = !shouldShow;

  if (!shouldShow) {
    return;
  }

  els.partnerMsTitle.textContent = getPairingDisplayName(acceptedPairing);

  LIST_TYPES.forEach((listType) => {
    const target = els.partnerMsLists[listType];
    const tasks = partnerState?.listSets?.schedms?.tasks?.[listType] || [];
    renderReadOnlyTaskList(listType, tasks, target.list, target.empty);
  });
}

function renderReadOnlyTaskList(listType, tasks, listEl, emptyEl) {
  const visibleTasks = getVisibleTasksForList(listType, orderTasksForList(listType, tasks));
  listEl.innerHTML = "";

  visibleTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item partner-task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    }`;
    item.dataset.taskId = task.id;
    item.dataset.owner = "partner";
    item.dataset.recurring = String(isRecurringTask(task));

    let partnerFavIndicator = null;
    if (task.priority) {
      partnerFavIndicator = document.createElement("span");
      partnerFavIndicator.className = "task-favorite-indicator";
      partnerFavIndicator.setAttribute("aria-label", "Favorited task");
      partnerFavIndicator.title = "Favorited task";
      partnerFavIndicator.innerHTML = `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    const label = document.createElement("label");
    label.className = "task-main";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.disabled = true;
    checkbox.setAttribute("aria-label", `${task.text} (read only)`);
    const copy = document.createElement("span");
    copy.className = "task-copy";
    copy.textContent = task.text;
    label.append(checkbox, copy);

    item.append(label);
    if (partnerFavIndicator) {
      item.appendChild(partnerFavIndicator);
    }
    listEl.appendChild(item);
  });

  emptyEl.hidden = visibleTasks.length > 0;
}

function renderList(listType) {
  const activeSet = getActiveListSet();
  const taskSet = activeSet.tasks[listType];
  const isRjPersistentList = state.activeListSet === "rj" && listType === "persistent";
  const surfaceTaskSet = isRjPersistentList ? taskSet.filter(isRjTodoTask) : taskSet;
  const listEl = els.lists[listType].list;
  const emptyEl = els.lists[listType].empty;
  const formEl = els.lists[listType].form;
  const isReadOnly = isReadOnlyView();

  formEl.style.display = shouldShowListForm(listType) ? "" : "none";
  setFormError(listType, "");

  if (isRjPersistentList) {
    const acceptedPairing = getAcceptedPairing();
    const hasPairing = Boolean(acceptedPairing);

    const myTasks = surfaceTaskSet.map((t) => {
      t._owner = "mine";
      return t;
    });

    const sharedTasks = (hasPairing ? (sharedRjState.tasks.todo || []) : []).map((t) => {
      t._owner = "shared";
      return t;
    });

    const combined = [...myTasks, ...sharedTasks];
    renderInteractiveRjList(combined, listEl, emptyEl, "mine", RJ_LIST_KIND_TODO);
    return;
  }

  const orderedTasks = orderTasksForList(listType, surfaceTaskSet);
  const visibleTasks = getVisibleTasksForList(listType, orderedTasks);

  listEl.innerHTML = "";

  visibleTasks.forEach((task) => {
    const isTaskEditing = isEditingTask(listType, task.id);
    const li = document.createElement("li");
    li.className = `task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    }`;
    li.dataset.taskId = task.id;
    li.dataset.owner = "mine";
    li.dataset.recurring = String(isRecurringTask(task));
    li.dataset.taskGroup = getRjTaskGroup(task);
    li.draggable =
      !isReadOnly &&
      !isTaskEditing &&
      !task.done &&
      !(state.activeListSet === "rj" && listType === "persistent");

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
      repeatBadge = document.createElement("span");
      repeatBadge.className = "task-badge";
      repeatBadge.textContent = "\u21bb";
      repeatBadge.setAttribute("aria-label", "Recurring");
      repeatBadge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = `task-action-btn favorite-btn ${task.priority ? "active is-favorite" : ""}`;
    favoriteBtn.setAttribute(
      "aria-label",
      `${task.priority ? "Remove favorite from" : "Mark as favorite"}: ${task.text}`
    );
    favoriteBtn.setAttribute("aria-pressed", String(task.priority));
    favoriteBtn.title = task.priority ? "Favorited (click to remove)" : "Favorite task";
    favoriteBtn.innerHTML = task.priority
      ? `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      : `<svg class="action-icon star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "task-action-btn edit-btn";
    editBtn.setAttribute("aria-label", `Edit task: ${task.text}`);
    editBtn.title = "Edit task";
    editBtn.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-action-btn delete-btn";
    deleteBtn.setAttribute("aria-label", `Remove task: ${task.text}`);
    deleteBtn.title = "Remove task";
    deleteBtn.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

    if (!isReadOnly) {
      const actionsToggle = document.createElement("button");
      actionsToggle.type = "button";
      actionsToggle.className = "task-actions-toggle";
      actionsToggle.setAttribute("aria-label", `More options for: ${task.text}`);
      actionsToggle.setAttribute("aria-expanded", "false");
      actionsToggle.title = "More options";
      actionsToggle.innerHTML = `<svg class="action-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
      actionsToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = !li.classList.contains("actions-open");
        dismissMobileTaskActions(willOpen ? li : null);
        li.classList.toggle("actions-open", willOpen);
        actionsToggle.setAttribute("aria-expanded", String(willOpen));
      });

      actions.append(favoriteBtn, editBtn, deleteBtn, actionsToggle);
    }

    if (isReadOnly || isTaskEditing) {
      checkbox.disabled = true;
      favoriteBtn.disabled = true;
      editBtn.disabled = true;
      deleteBtn.disabled = true;
    }

    let taskActionStarted = false;
    let taskPointerStart = null;
    let priorityToggleStarted = false;

    const togglePriority = () => {
      if (isReadOnlyView() || favoriteBtn.disabled || priorityToggleStarted) {
        return;
      }

      priorityToggleStarted = true;
      task.priority = !task.priority;
      saveState();
      renderAll();
    };

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
        playTaskCompleteSound(task.priority);
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

    wireMobileTaskGesture(li, checkbox, setTaskDone);

    li.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0 ||
        checkbox.disabled ||
        event.target.closest(".task-action-btn, .task-priority-btn, .task-actions-toggle")
      ) {
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
        event.target.closest(".task-action-btn, .task-priority-btn, .task-actions-toggle")
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

    favoriteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePriority();
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
      favoriteBtn.disabled = true;
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
      favoriteBtn.disabled = true;
      deleteBtn.disabled = true;
      editBtn.disabled = true;
      li.draggable = false;
      setFormError(listType, "");
      setRecurringError("");

      const editListSetId = state.activeListSet;
      runTaskEditAnimation(li, listType, task, () => {
        if (state.activeListSet !== editListSetId || !isEditingTask(listType, task.id)) {
          return;
        }

        focusTaskEditInput(listType);
      });
    };

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
    if (actions) {
      li.appendChild(actions);
    }
    if (repeatBadge) {
      li.appendChild(repeatBadge);
    }
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
    const kindLabel = createRecurringKindLabel(task);

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
    li.append(kindLabel, copy);

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

function renderRjSchedulePanels() {
  renderRecurringPanel();
  renderSharedRecurringPanel([...sharedRjState.tasks.todo, ...sharedRjState.tasks.schedule]);
  renderPartnerRecurringPanel(partnerState?.listSets?.rj?.tasks?.persistent || []);
}

// Mobile taps toggle completion; movement is reserved for scrolling.
function isMobileTaskView() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function dismissMobileTaskActions(except = null) {
  document.querySelectorAll(".task-item.actions-visible, .task-item.actions-open").forEach((item) => {
    if (item === except) return;
    item.classList.remove("actions-visible", "actions-open");
    item.querySelector(".task-actions-toggle")?.setAttribute("aria-expanded", "false");
  });
}

function wireMobileTaskGesture(item, checkbox, setTaskDone) {
  let start = null;
  let scrolled = false;
  const isControl = (event) => event.target.closest("button, a, select, textarea");
  const clear = () => { start = null; };
  item.addEventListener("dragstart", (event) => {
    if (isMobileTaskView()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  item.addEventListener("pointerdown", (event) => {
    if (!isMobileTaskView() || isControl(event) || checkbox.disabled || event.button !== 0) return;
    event.stopImmediatePropagation();
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    scrolled = false;
    if (event.isTrusted) item.setPointerCapture?.(event.pointerId);
  }, true);
  item.addEventListener("pointermove", (event) => {
    if (!start || start.id !== event.pointerId) return;
    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    if (dx > 8 || dy > 8) scrolled = true;
  });
  item.addEventListener("pointerup", (event) => {
    if (!isMobileTaskView() || !start || start.id !== event.pointerId) return;
    event.stopImmediatePropagation();
    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    clear();
    if (!scrolled && dx <= 8 && dy <= 8) {
      event.preventDefault();
      dismissMobileTaskActions();
      setTaskDone(!checkbox.checked);
    }
  }, true);
  item.addEventListener("pointercancel", () => { clear(); dismissMobileTaskActions(); });
  item.addEventListener("click", (event) => {
    if (!isMobileTaskView() || isControl(event)) return;
    // Keep keyboard checkbox activation available; suppress touch label toggles.
    if (event.detail === 0 && event.target === checkbox) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

function wireMobileTaskDismissal() {
  window.matchMedia("(max-width: 900px)").addEventListener("change", (event) => {
    if (event.matches && editState) cancelTaskEdit();
  });
  document.addEventListener("pointerdown", (event) => {
    if (isMobileTaskView()) dismissMobileTaskActions(event.target.closest(".task-item"));
  }, true);
  document.addEventListener("scroll", () => {
    if (isMobileTaskView()) dismissMobileTaskActions();
  }, true);
}
