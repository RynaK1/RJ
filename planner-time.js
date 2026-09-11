// Planner date, recurrence, and reset-label helpers. Loaded before app.js.

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

function currentPlannerDayIndex(date = new Date()) {
  return currentPlannerDate(date).getUTCDay();
}

function doesRecurringTaskShowToday(task, date = new Date()) {
  const showDays = getEffectiveRecurringShowDays(task);

  return showDays.length === 0 || showDays.includes(currentPlannerDayIndex(date));
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
  if (isRecurringTask(task)) {
    const typeLabel = formatScheduledTaskTypeLabel(task);

    if (normalizeRecurringIntervalDays(task.intervalDays) === 1) {
      return typeLabel;
    }

    return `${typeLabel} | ${formatRecurringShowDays(task)}`;
  }

  return formatScheduledTaskTypeLabel(task);
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
    return "Active";
  }

  return "";
}

function doesScheduledTaskShowToday(task) {
  return getTaskAppearanceDateId(task) === dailyPeriodId(new Date()) && !task.done;
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

