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
  els.mineRjScheduleCard.hidden = !isRjMode;
  els.sharedRjTodoCard.hidden = !hasPairedRjList;
  els.sharedRjScheduleCard.hidden = !hasPairedRjList;
  els.partnerRjCard.hidden = !hasPairedRjList;
  els.partnerRjScheduleCard.hidden = !hasPairedRjList;
  els.sharedRjColumnHeader.hidden = !hasPairedRjList;
  els.partnerRjColumnHeader.hidden = !hasPairedRjList;
  els.mineMsTitle.hidden = !hasPairedMsLists;
  els.partnerMsSection.hidden = !hasPairedMsLists;
  els.persistentListTitle.textContent = isRjMode ? "To-do" : "To-Do";
  updateRjTargetButtons();

  if (!isRjMode) {
    closeRecurringForm();
    closeRjSchedulePanel();
  }
}

function renderListSetSwitcher() {
  els.listSetButtons.forEach((button) => {
    const isActive = button.dataset.listSet === state.activeListSet;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderMineRjScheduleList() {
  if (state.activeListSet !== "rj") {
    return;
  }

  const tasks = state.listSets.rj.tasks.persistent.filter(isRjScheduleTask);
  renderInteractiveRjList(tasks, els.mineRjScheduleList, els.mineRjScheduleEmpty, "mine", RJ_LIST_KIND_SCHEDULE);
}

function renderSharedRjLists() {
  resetSharedRjDayIfNeeded();
  const shouldShow = state.activeListSet === "rj" && Boolean(getAcceptedPairing());

  if (!shouldShow) {
    els.sharedRjTodoList.innerHTML = "";
    els.sharedRjScheduleList.innerHTML = "";
    return;
  }

  renderInteractiveRjList(
    sharedRjState.tasks.todo,
    els.sharedRjTodoList,
    els.sharedRjTodoEmpty,
    "shared",
    RJ_LIST_KIND_TODO
  );
  renderInteractiveRjList(
    sharedRjState.tasks.schedule,
    els.sharedRjScheduleList,
    els.sharedRjScheduleEmpty,
    "shared",
    RJ_LIST_KIND_SCHEDULE
  );
}

function renderInteractiveRjList(tasks, listEl, emptyEl, owner, kind) {
  const orderedTasks =
    kind === RJ_LIST_KIND_TODO
      ? getVisibleTasksForList("persistent", orderTasksForList("persistent", tasks))
      : getVisibleTasksForList("persistent", orderTasksByDone(tasks));
  listEl.innerHTML = "";
  wireRjListDragSurface(listEl, owner, kind);

  orderedTasks.forEach((task) => {
    const isTaskEditing = isEditingTask("persistent", task.id);
    const item = document.createElement("li");
    item.className = `task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    }`;
    item.dataset.taskId = task.id;
    item.dataset.recurring = String(isRecurringTask(task));
    item.dataset.taskGroup = getRjTaskGroup(task);
    item.draggable = !task.done && !isTaskEditing;

    if (isTaskEditing) {
      item.classList.add("editing");
    }

    if (pendingAppendAnimations.has(task.id)) {
      item.classList.add("append-enter");
    }

    item.addEventListener("dragstart", (event) => {
      if (task.done || isTaskEditing || event.target.closest("button")) {
        event.preventDefault();
        return;
      }

      rjDragState = {
        owner,
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

    const priorityButton = document.createElement("button");
    priorityButton.type = "button";
    priorityButton.className = `task-priority-btn ${task.priority ? "active" : ""}`;
    priorityButton.setAttribute(
      "aria-label",
      `${task.priority ? "Remove priority from" : "Mark as priority"}: ${task.text}`
    );
    priorityButton.setAttribute("aria-pressed", String(task.priority));
    const priorityIcon = document.createElement("span");
    priorityIcon.className = "priority-star-icon";
    priorityIcon.setAttribute("aria-hidden", "true");
    priorityIcon.textContent = task.priority ? "\u2605" : "\u2606";
    priorityButton.appendChild(priorityIcon);

    const label = document.createElement("label");
    label.className = "task-main";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", task.text);
    const copy = document.createElement("span");
    copy.className = "task-copy";
    copy.textContent = task.text;
    label.append(checkbox, copy);

    if (isRecurringTask(task)) {
      const repeatBadge = document.createElement("span");
      repeatBadge.className = "task-badge";
      repeatBadge.textContent = "\u21bb";
      repeatBadge.setAttribute("aria-label", "Recurring");
      repeatBadge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
      label.appendChild(repeatBadge);
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";
    const actionsToggleButton = document.createElement("button");
    actionsToggleButton.type = "button";
    actionsToggleButton.className = "task-action-btn task-actions-toggle";
    actionsToggleButton.setAttribute("aria-label", `Show actions for: ${task.text}`);
    actionsToggleButton.setAttribute("aria-expanded", "false");
    actionsToggleButton.textContent = "\u22ef";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "task-action-btn edit-btn";
    editButton.setAttribute("aria-label", `Edit item: ${task.text}`);
    editButton.title = "Edit item";
    const editIcon = document.createElement("span");
    editIcon.className = "edit-icon";
    editIcon.setAttribute("aria-hidden", "true");
    editButton.appendChild(editIcon);
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "task-action-btn delete-btn";
    deleteButton.setAttribute("aria-label", `Remove item: ${task.text}`);
    deleteButton.title = "Remove item";
    const trashIcon = document.createElement("span");
    trashIcon.className = "trash-icon";
    trashIcon.setAttribute("aria-hidden", "true");
    deleteButton.appendChild(trashIcon);
    actions.append(actionsToggleButton, editButton, deleteButton);

    if (isTaskEditing) {
      checkbox.disabled = true;
      priorityButton.disabled = true;
      actionsToggleButton.disabled = true;
      editButton.disabled = true;
      deleteButton.disabled = true;
    }

    let taskActionStarted = false;
    let taskPointerStart = null;
    let priorityToggleStarted = false;

    const persistChange = () => {
      if (owner === "shared") {
        saveSharedRjState();
      } else {
        saveState();
      }
      renderAll();
    };

    const togglePriority = () => {
      if (priorityButton.disabled || priorityToggleStarted) {
        return;
      }

      priorityToggleStarted = true;
      task.priority = !task.priority;
      persistChange();
    };

    const setTaskDone = (nextDone) => {
      if (checkbox.disabled || taskActionStarted || task.done === nextDone) {
        checkbox.checked = task.done;
        return;
      }

      taskActionStarted = true;
      if (nextDone) {
        playTaskCompleteSound(task.priority);
      }

      if (owner === "mine") {
        moveTaskAfterDoneChange("persistent", task.id, nextDone);
      } else {
        setTaskCompletionState(task, nextDone);
        updateRecurringTaskCompletionFields(task, nextDone);
      }
      persistChange();
    };

    wireMobileTaskGesture(item, checkbox, setTaskDone);

    item.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0 ||
        checkbox.disabled ||
        event.target.closest(".task-action-btn, .task-priority-btn")
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
        event.target.closest(".task-action-btn, .task-priority-btn")
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

    actionsToggleButton.addEventListener("click", () => {
      const isOpen = item.classList.toggle("actions-open");
      actionsToggleButton.setAttribute("aria-expanded", String(isOpen));
      actionsToggleButton.setAttribute("aria-label", `${isOpen ? "Hide" : "Show"} actions for: ${task.text}`);
    });

    priorityButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || priorityButton.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      togglePriority();
    });

    priorityButton.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePriority();
    });

    const editTask = () => {
      if (editButton.disabled || taskActionStarted) {
        return;
      }

      taskActionStarted = true;
      checkbox.disabled = true;
      priorityButton.disabled = true;
      editButton.disabled = true;
      deleteButton.disabled = true;
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
        { owner, rjKind: kind }
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
      if (owner === "mine") {
        if (!removeTaskFromList("persistent", task.id)) {
          return;
        }
      } else {
        const taskIndex = tasks.findIndex((candidate) => candidate.id === task.id);
        if (taskIndex < 0) {
          return;
        }
        tasks.splice(taskIndex, 1);
      }
      pendingAppendAnimations.delete(task.id);
      persistChange();
    });

    item.append(priorityButton, label, actions);
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

    return true;
  };
  const taskById = new Map(sourceTasks.filter(shouldReorder).map((task) => [task.id, task]));
  const orderedTasks = reorderedIds.map((taskId) => taskById.get(taskId)).filter(Boolean);
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

  const partnerName = getPairingDisplayName(acceptedPairing);
  els.partnerRjTitle.textContent = "To-do";
  els.partnerRjScheduleTitle.textContent = "Schedule";
  els.partnerRjColumnTitle.textContent = partnerName;
  els.partnerRjList.setAttribute("aria-label", `${partnerName}'s IRL list`);
  els.partnerRjScheduleList.setAttribute("aria-label", `${partnerName}'s schedule`);

  if (partnerState) resetRjDay(partnerState.listSets.rj, dailyPeriodId(new Date()));
  const partnerTasks = partnerState?.listSets?.rj?.tasks?.persistent || [];
  const tasks = partnerTasks.filter(isRjTodoTask);
  const visibleTasks = getVisibleTasksForList("persistent", orderTasksForList("persistent", tasks));

  visibleTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item partner-task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    }`;

    const priority = document.createElement("span");
    priority.className = `task-priority-btn ${task.priority ? "active" : ""}`;
    priority.setAttribute("aria-hidden", "true");
    const priorityIcon = document.createElement("span");
    priorityIcon.className = "priority-star-icon";
    priorityIcon.textContent = task.priority ? "\u2605" : "\u2606";
    priority.appendChild(priorityIcon);

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

    if (isRecurringTask(task)) {
      const badge = document.createElement("span");
      badge.className = "task-badge";
      badge.textContent = "\u21bb";
      badge.setAttribute("aria-label", "Recurring");
      badge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
      label.appendChild(badge);
    }

    item.append(priority, label);
    els.partnerRjList.appendChild(item);
  });

  els.partnerRjEmpty.hidden = visibleTasks.length > 0;
  renderReadOnlyRjScheduleList(partnerTasks.filter(isRjScheduleTask));
}

function renderReadOnlyRjScheduleList(tasks) {
  const orderedTasks = getVisibleTasksForList("persistent", orderTasksByDone(tasks));
  els.partnerRjScheduleList.innerHTML = "";

  orderedTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item partner-task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""} ${
      isRecurringTask(task) ? "recurring-task" : ""
    }`;
    const priority = document.createElement("span");
    priority.className = `task-priority-btn ${task.priority ? "active" : ""}`;
    priority.setAttribute("aria-hidden", "true");
    const priorityIcon = document.createElement("span");
    priorityIcon.className = "priority-star-icon";
    priorityIcon.textContent = task.priority ? "\u2605" : "\u2606";
    priority.appendChild(priorityIcon);
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

    if (isRecurringTask(task)) {
      const badge = document.createElement("span");
      badge.className = "task-badge";
      badge.textContent = "\u21bb";
      badge.setAttribute("aria-label", "Recurring");
      badge.title = `${formatRecurringIntervalLabel(task.intervalDays)}; ${formatRecurringShowDays(task)}`;
      label.appendChild(badge);
    }

    item.append(priority, label);
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
    item.className = `task-item partner-task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""}`;

    const priority = document.createElement("span");
    priority.className = `task-priority-btn ${task.priority ? "active" : ""}`;
    priority.setAttribute("aria-hidden", "true");
    const priorityIcon = document.createElement("span");
    priorityIcon.className = "priority-star-icon";
    priorityIcon.textContent = task.priority ? "\u2605" : "\u2606";
    priority.appendChild(priorityIcon);

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

    item.append(priority, label);
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
    renderInteractiveRjList(surfaceTaskSet, listEl, emptyEl, "mine", RJ_LIST_KIND_TODO);
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

    const priorityBtn = document.createElement("button");
    priorityBtn.type = "button";
    priorityBtn.className = `task-priority-btn ${task.priority ? "active" : ""}`;
    priorityBtn.setAttribute("aria-label", `${task.priority ? "Remove priority from" : "Mark as priority"}: ${task.text}`);
    priorityBtn.setAttribute("aria-pressed", String(task.priority));
    priorityBtn.title = task.priority ? "Priority task" : "Mark priority";

    const priorityIcon = document.createElement("span");
    priorityIcon.className = "priority-star-icon";
    priorityIcon.setAttribute("aria-hidden", "true");
    priorityIcon.textContent = task.priority ? "\u2605" : "\u2606";
    priorityBtn.appendChild(priorityIcon);

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
      label.appendChild(repeatBadge);
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const actionsToggleBtn = document.createElement("button");
    actionsToggleBtn.type = "button";
    actionsToggleBtn.className = "task-action-btn task-actions-toggle";
    actionsToggleBtn.setAttribute("aria-label", `Show actions for: ${task.text}`);
    actionsToggleBtn.setAttribute("aria-expanded", "false");
    actionsToggleBtn.textContent = "\u22ef";

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
      actions.append(actionsToggleBtn, editBtn, deleteBtn);
    }

    if (isReadOnly || isTaskEditing) {
      checkbox.disabled = true;
      priorityBtn.disabled = true;
      editBtn.disabled = true;
      deleteBtn.disabled = true;
      actionsToggleBtn.disabled = true;
    }

    let taskActionStarted = false;
    let taskPointerStart = null;
    let priorityToggleStarted = false;

    actionsToggleBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = li.classList.toggle("actions-open");
      actionsToggleBtn.setAttribute("aria-expanded", String(isOpen));
      actionsToggleBtn.setAttribute("aria-label", `${isOpen ? "Hide" : "Show"} actions for: ${task.text}`);
    });

    const togglePriority = () => {
      if (isReadOnlyView() || priorityBtn.disabled || priorityToggleStarted) {
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
        event.target.closest(".task-action-btn, .task-priority-btn")
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
        event.target.closest(".task-action-btn, .task-priority-btn")
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

    priorityBtn.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || priorityBtn.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      togglePriority();
    });

    priorityBtn.addEventListener("click", (event) => {
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

    li.append(priorityBtn, label, actions);
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

// Mobile taps expose controls; deliberate horizontal swipes toggle completion.
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
  const clear = () => { start = null; item.classList.remove("swipe-ready"); };
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
    if (dy > 12 && dy > dx) { scrolled = true; dismissMobileTaskActions(); }
    item.classList.toggle("swipe-ready", !scrolled && dx >= Math.max(72, Math.min(120, item.clientWidth * 0.25)) && dx > dy * 2);
  });
  item.addEventListener("pointerup", (event) => {
    if (!isMobileTaskView() || !start || start.id !== event.pointerId) return;
    event.stopImmediatePropagation();
    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    const threshold = Math.max(72, Math.min(120, item.clientWidth * 0.25));
    clear();
    if (!scrolled && dx >= threshold && dx > dy * 2) {
      event.preventDefault();
      dismissMobileTaskActions();
      setTaskDone(!checkbox.checked);
    } else if (dx <= 8 && dy <= 8 && !scrolled) {
      dismissMobileTaskActions(item);
      item.classList.add("actions-visible");
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
  document.addEventListener("pointerdown", (event) => {
    if (isMobileTaskView()) dismissMobileTaskActions(event.target.closest(".task-item"));
  }, true);
  document.addEventListener("scroll", () => {
    if (isMobileTaskView()) dismissMobileTaskActions();
  }, true);
}
