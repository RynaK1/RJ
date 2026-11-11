// Task editing and saving. Uses shared state and DOM references from app.js.

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

function updateEditedTask(listType, text, isTaskOptionsSubmit, targetKind = null) {
  if (isReadOnlyView()) {
    return;
  }

  const isRjEdit = state.activeListSet === "rj" && listType === "persistent";
  const editOwner = isRjEdit && editState?.owner === "shared" ? "shared" : "mine";
  const editKind = normalizeRjListKind(editState?.rjKind) || RJ_LIST_KIND_TODO;
  const taskCollection =
    editOwner === "shared" ? sharedRjState.tasks[editKind] : getActiveListSet().tasks[listType];
  let task = taskCollection ? taskCollection.find((item) => item.id === editState.taskId) : null;

  if (!task && editOwner === "shared") {
    const fallbackKind = editKind === RJ_LIST_KIND_SCHEDULE ? RJ_LIST_KIND_TODO : RJ_LIST_KIND_SCHEDULE;
    task = (sharedRjState.tasks[fallbackKind] || []).find((item) => item.id === editState.taskId);
  }

  if (!task) {
    cancelTaskEdit(listType);
    return;
  }

  const nextOwner = isRjEdit ? rjComposerOwner : editOwner;
  const nextKind = normalizeRjListKind(targetKind || (isRjEdit ? activeRjComposerKind : null)) || editKind;
  if (isRjEdit && nextOwner === "shared" && !getAcceptedPairing()) {
    setFormError(listType, "Pair with another user before moving shared items.");
    return;
  }

  const beforePositions = isRjEdit ? null : captureTaskPositions(listType);
  const wasRecurring = isRecurringTask(task);
  const wasScheduled = isScheduledOneTimeTask(task);

  task.text = text;

  if (isRjEdit) {
    task.irlKind = nextKind;

    if (nextKind === RJ_LIST_KIND_SCHEDULE) {
      const chosenDate = els.rjScheduleDate?.value || task.showOnDate || dailyPeriodId(new Date());
      task.showOnDate = chosenDate;

      if (usesRecurringTaskGrouping(listType) && isTaskOptionsSubmit && recurringCreateMode) {
        applyRjTaskOptions(task, !wasRecurring && !wasScheduled);
        task.showOnDate = chosenDate;
      } else if (!isRecurringTask(task)) {
        delete task.recurring;
        delete task.intervalDays;
        delete task.showDays;
        delete task.recurringStartDate;
        delete task.nextDueDate;
      }
    } else {
      if (usesRecurringTaskGrouping(listType) && isTaskOptionsSubmit && recurringCreateMode) {
        applyRjTaskOptions(task, !wasRecurring && !wasScheduled);
      } else {
        clearTaskTimingFields(task);
      }
    }

    const destination = nextOwner === "shared"
      ? sharedRjState.tasks[nextKind]
      : getActiveListSet().tasks[listType];
    const sourceCollection = editOwner === "shared"
      ? (sharedRjState.tasks[editKind]?.includes(task) ? sharedRjState.tasks[editKind] : sharedRjState.tasks[editKind === "schedule" ? "todo" : "schedule"])
      : getActiveListSet().tasks[listType];

    if (destination !== sourceCollection && sourceCollection) {
      const idx = sourceCollection.indexOf(task);
      if (idx !== -1) {
        sourceCollection.splice(idx, 1);
      }
      destination.push(task);
    }
  } else {
    if (usesRecurringTaskGrouping(listType) && isTaskOptionsSubmit) {
      applyRjTaskOptions(task, !wasRecurring && !wasScheduled);
    } else if (usesRecurringTaskGrouping(listType) && (wasRecurring || wasScheduled)) {
      clearTaskTimingFields(task);
    }
  }

  finishTaskEdit(listType);
  if (editOwner === "shared" || nextOwner === "shared") {
    saveSharedRjState();
  }
  if (editOwner === "mine" || nextOwner === "mine") {
    saveState();
  }
  renderAll();
  if (beforePositions) {
    animateListReflow(listType, beforePositions);
  }
}

function getTaskInput(listType) {
  return getTaskEditForm(listType).querySelector("input");
}

function getTaskSubmitButton(listType) {
  return getTaskEditForm(listType).querySelector(".add-task-submit-btn, .rj-target-btn");
}

function getTaskEditForm(listType) {
  return usesSchedmsEditBar() ? els.schedmsAddForm : els.lists[listType].form;
}

function usesSchedmsEditBar() {
  return state.activeListSet === "schedms";
}

function isEditingTask(listType, taskId = null) {
  if (!editState || editState.listSetId !== state.activeListSet || editState.listType !== listType) {
    return false;
  }

  return taskId === null || editState.taskId === taskId;
}

function getListTypeTaskLabel(listType) {
  if (listType === "persistent") {
    if (state.activeListSet === "rj" && editState?.rjKind === RJ_LIST_KIND_SCHEDULE) {
      return "event";
    }

    return "to-do task";
  }

  return `${listType} task`;
}

function updateTaskInputPlaceholder(listType) {
  const input = getTaskInput(listType);

  if (isEditingTask(listType)) {
    if (state.activeListSet === "rj" && listType === "persistent") {
      const itemLabel = editState?.rjKind === RJ_LIST_KIND_SCHEDULE ? "event" : "to-do item";
      input.placeholder = recurringCreateMode ? `Edit ${itemLabel} options` : `Edit ${itemLabel}`;
    } else {
      input.placeholder = EDIT_TASK_PLACEHOLDERS[listType];
    }
    return;
  }

  if (usesSchedmsEditBar()) {
    input.placeholder = "Add task";
    return;
  }

  if (state.activeListSet === "rj" && listType === "persistent") {
    input.placeholder = "Add a to-do or event";
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
  const taskLabel = getListTypeTaskLabel(listType);
  form.classList.toggle("editing-task", isEditing);

  if (form.classList.contains("rj-composer-form")) {
    updateRjTargetButtons();
  } else {
    submitButton.textContent = isEditing ? SAVE_TASK_SYMBOL : ADD_TASK_SYMBOL;
    submitButton.setAttribute("aria-label", isEditing ? `Save ${taskLabel}` : `Add ${taskLabel}`);
    submitButton.title = isEditing ? "Save task" : "Add task";
  }
  updateTaskInputPlaceholder(listType);

  if (usesSchedmsEditBar()) {
    syncCustomSelect(els.schedmsTargetList);
  }

}

function prepareTaskEditMode(listType, task, editContext = {}) {
  const taskId = task.id;

  if (editState && !isEditingTask(listType, taskId)) {
    finishTaskEdit(editState.listType);
  }

  const isRj = state.activeListSet === "rj" && listType === "persistent";
  const rjKind = normalizeRjListKind(
    editContext.rjKind || task?.irlKind || (isRjScheduleTask(task) ? RJ_LIST_KIND_SCHEDULE : RJ_LIST_KIND_TODO)
  );

  editState = {
    listSetId: state.activeListSet,
    listType,
    taskId,
    owner: editContext.owner === "shared" ? "shared" : (task._owner === "shared" ? "shared" : "mine"),
    rjKind,
  };

  if (isRj) {
    rjComposerOwner = editState.owner;
    activeRjComposerKind = rjKind;

    if (rjKind === RJ_LIST_KIND_SCHEDULE) {
      const taskDate = task.showOnDate || dailyPeriodId(new Date());
      if (els.rjScheduleDate) {
        els.rjScheduleDate.value = taskDate;
      }
      if (els.rjScheduleDateWrap) {
        els.rjScheduleDateWrap.hidden = false;
      }
    } else {
      if (els.rjScheduleDateWrap) {
        els.rjScheduleDateWrap.hidden = true;
      }
    }
    updateRjTargetButtons();
  }

  const input = getTaskInput(listType);
  input.value = task.text.slice(0, MAX_TASK_TEXT_LENGTH);

  if (usesSchedmsEditBar()) {
    els.schedmsTargetList.value = listType;
    syncCustomSelect(els.schedmsTargetList);
  }

  if (usesRecurringTaskGrouping(listType)) {
    const isRecur = isRecurringTask(task);
    setRecurringCreateMode(isRecur);
    if (isRecur) {
      hydrateRecurringControlsFromTask(task);
    } else {
      closeRecurringForm({ immediate: true });
    }
  } else {
    updateTaskInputPlaceholder(listType);
  }

  setTaskFormEditingState(listType, true);
}

function focusTaskEditInput(listType) {
  const input = getTaskInput(listType);
  if (!input) return;
  window.requestAnimationFrame(() => {
    input.focus();
    input.select();
    if (typeof isMobileTaskView === "function" && isMobileTaskView()) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
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

  if (state.activeListSet === "rj" && listType === "persistent") {
    activeRjComposerKind = RJ_LIST_KIND_TODO;
    if (els.rjScheduleDateWrap) {
      els.rjScheduleDateWrap.hidden = true;
    }
    if (els.rjScheduleDate) {
      els.rjScheduleDate.value = dailyPeriodId(new Date());
    }
    updateRjTargetButtons();
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

function handleTaskEditOutsideClick(event) {
  if (!editState || isTaskEditInteraction(event)) {
    return;
  }

  cancelTaskEdit();
}

function isTaskEditInteraction(event) {
  const editedListType = editState?.listType;

  if (!editedListType) {
    return false;
  }

  const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
  const allowedSurfaces = [getTaskEditForm(editedListType)];

  if (usesSchedmsEditBar()) {
    allowedSurfaces.push(els.schedmsTargetList, els.schedmsTargetList.closest(".custom-select"));
  } else if (usesRecurringTaskGrouping(editedListType)) {
    allowedSurfaces.push(els.recurringToggleBtn, els.recurringTools);
  }

  return allowedSurfaces.some(
    (surface) => surface && (eventPath.includes(surface) || surface.contains(event.target))
  );
}
