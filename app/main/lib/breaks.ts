import { PowerMonitor } from "electron";
import log from "electron-log";
import moment from "moment";
import { BreakTime } from "../../types/breaks";
import { IpcChannel } from "../../types/ipc";
import {
  DayConfig,
  NotificationType,
  Settings,
  SoundType,
  usesBreakWindows,
} from "../../types/settings";
import { sendIpc } from "./ipc";
import { showNotification } from "./notifications";
import { getSettings } from "./store";
import { buildTray } from "./tray";
import { createBreakWindows } from "./windows";

// Helper function to strip HTML tags from text
function stripHtml(html: string): string {
  // First convert <br> tags to spaces
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
}

type SystemIdleMonitor = Pick<PowerMonitor, "getSystemIdleState">;

let powerMonitor: SystemIdleMonitor;
let breakTime: BreakTime = null;
let havingBreak = false;
let postponedCount = 0;
let idleStart: Date | null = null;
let lockStart: Date | null = null;
let lastTick: Date | null = null;
let startedFromTray = false;

let lastCompletedBreakTime: Date | null = new Date();
let currentBreakStartTime: Date | null = null;
let pausedRemainingSeconds: number | null = null;

export function getBreakTime(): BreakTime {
  return breakTime;
}

export function getBreakLengthSeconds(): number {
  const settings: Settings = getSettings();
  return settings.breakLengthSeconds;
}

export function getTimeSinceLastBreak(): number | null {
  const now = moment();
  const lastBreak = moment(lastCompletedBreakTime);
  return now.diff(lastBreak, "seconds");
}

export function getTimeSinceLastCompletedBreak(): number | null {
  const now = moment();
  const lastBreak = moment(lastCompletedBreakTime);
  return now.diff(lastBreak, "seconds");
}

export function getPausedRemainingSeconds(): number | null {
  return pausedRemainingSeconds;
}

export function isSittingTimerPaused(): boolean {
  return pausedRemainingSeconds !== null;
}

export function getStandingRemainingSeconds(): number | null {
  if (!havingBreak || !currentBreakStartTime) {
    return null;
  }

  const requiredDurationMs = getSettings().breakLengthSeconds * 1000;
  const elapsedMs = Date.now() - currentBreakStartTime.getTime();
  return Math.max(0, Math.round((requiredDurationMs - elapsedMs) / 1000));
}

function isReminderMode(settings: Settings = getSettings()): boolean {
  return settings.notificationType === NotificationType.Reminder;
}

function clearSittingPause(): void {
  pausedRemainingSeconds = null;
}

export function startBreakTracking(): void {
  currentBreakStartTime = new Date();
}

export function resetTimeSinceLastBreak(context: string): void {
  lastCompletedBreakTime = new Date();
  log.info(context);
  buildTray();
}

function markBreakCompleted(context: string): void {
  resetTimeSinceLastBreak(context);
  currentBreakStartTime = null;
}

export function completeBreakTracking(breakDurationMs: number): void {
  if (!currentBreakStartTime) return;

  const settings = getSettings();
  const requiredDurationMs = settings.breakLengthSeconds * 1000;
  const halfRequiredDuration = requiredDurationMs / 2;

  if (isReminderMode(settings) || breakDurationMs >= halfRequiredDuration) {
    markBreakCompleted(
      `Break completed [duration=${Math.round(
        breakDurationMs / 1000,
      )}s] [required=${settings.breakLengthSeconds}s]`,
    );
  } else {
    log.info(
      `Break too short [duration=${Math.round(
        breakDurationMs / 1000,
      )}s] [required=${settings.breakLengthSeconds}s]`,
    );
  }

  currentBreakStartTime = null;
}

function zeroPad(n: number) {
  const nStr = String(n);
  return nStr.length === 1 ? `0${nStr}` : nStr;
}

function getSecondsFromSettings(seconds: number): number {
  return seconds || 1; // can't be 0
}

function getIdleResetSeconds(): number {
  const settings: Settings = getSettings();
  return getSecondsFromSettings(settings.idleResetLengthSeconds);
}

function getBreakSeconds(): number {
  const settings: Settings = getSettings();
  return getSecondsFromSettings(settings.breakFrequencySeconds);
}

function createIdleNotification() {
  const settings: Settings = getSettings();

  if (!settings.idleResetEnabled || idleStart === null) {
    return;
  }

  let idleSeconds = Number(((+new Date() - +idleStart) / 1000).toFixed(0));
  let idleMinutes = 0;
  let idleHours = 0;

  if (idleSeconds > 60) {
    idleMinutes = Math.floor(idleSeconds / 60);
    idleSeconds -= idleMinutes * 60;
  }

  if (idleMinutes > 60) {
    idleHours = Math.floor(idleMinutes / 60);
    idleMinutes -= idleHours * 60;
  }

  if (settings.idleResetNotification) {
    showNotification(
      "Break automatically detected",
      `Away for ${zeroPad(idleHours)}:${zeroPad(idleMinutes)}:${zeroPad(
        idleSeconds,
      )}`,
    );
  }
}

export function scheduleNextBreak(isPostpone = false): void {
  const settings: Settings = getSettings();
  clearSittingPause();

  if (idleStart) {
    createIdleNotification();
    idleStart = null;
    postponedCount = 0;

    resetTimeSinceLastBreak("Break auto-detected via idle reset");
  }

  const seconds = isPostpone
    ? settings.postponeLengthSeconds
    : settings.breakFrequencySeconds;

  breakTime = moment().add(seconds, "seconds");

  log.info(
    `Scheduling next break [isPostpone=${isPostpone}] [seconds=${seconds}] [postponeLength=${settings.postponeLengthSeconds}] [frequency=${settings.breakFrequencySeconds}] [scheduledFor=${breakTime.format("HH:mm:ss")}]`,
  );

  buildTray();
}

export function endPopupBreak(): void {
  if (currentBreakStartTime) {
    const breakDurationMs = Date.now() - currentBreakStartTime.getTime();
    completeBreakTracking(breakDurationMs);
  }

  log.info("Break ended");
  const existingBreakTime = breakTime;
  const now = moment();
  havingBreak = false;
  startedFromTray = false;

  // If there's no future break scheduled, create a normal break
  if (!existingBreakTime || existingBreakTime <= now) {
    postponedCount = 0;
    breakTime = null;
    scheduleNextBreak();
  }
  // If there's already a future break scheduled (from snooze/skip), keep it

  buildTray();
}

export function getAllowPostpone(): boolean {
  const settings = getSettings();
  return !settings.postponeLimit || postponedCount < settings.postponeLimit;
}

export function postponeBreak(action = "snoozed"): void {
  postponedCount++;
  havingBreak = false;
  log.info(`Break ${action} [count=${postponedCount}]`);

  if (action === "skipped") {
    log.info("Creating break with normal frequency");
    scheduleNextBreak();
  } else {
    log.info("Creating break with postpone length");
    scheduleNextBreak(true);
  }
}

function doBreak(): void {
  havingBreak = true;
  clearSittingPause();

  const settings: Settings = getSettings();
  log.info(`Break started [type=${settings.notificationType}]`);

  if (
    settings.notificationType === NotificationType.Notification ||
    startedFromTray ||
    (settings.immediatelyStartBreaks && !isReminderMode(settings))
  ) {
    startBreakTracking();
  }

  if (settings.notificationType === NotificationType.Notification) {
    showNotification("Time for a break!", stripHtml(settings.breakMessage));
    if (settings.soundType !== SoundType.None) {
      sendIpc(
        IpcChannel.SoundStartPlay,
        settings.soundType,
        settings.breakSoundVolume,
      );
    }
    markBreakCompleted("Break completed [type=notification]");
    havingBreak = false;
    scheduleNextBreak();
  }

  if (usesBreakWindows(settings.notificationType)) {
    if (isReminderMode(settings) && settings.soundType !== SoundType.None) {
      sendIpc(
        IpcChannel.SoundStartPlay,
        settings.soundType,
        settings.breakSoundVolume,
      );
    }
    createBreakWindows();
  }

  buildTray();
}

function checkInWorkingHoursAt(
  now: moment.Moment,
  settings: Settings,
): boolean {
  if (!settings.workingHoursEnabled) {
    return true;
  }

  const currentMinutes = now.hours() * 60 + now.minutes();
  const dayOfWeek = now.day();

  const dayMap: { [key: number]: DayConfig["key"] } = {
    0: "workingHoursSunday",
    1: "workingHoursMonday",
    2: "workingHoursTuesday",
    3: "workingHoursWednesday",
    4: "workingHoursThursday",
    5: "workingHoursFriday",
    6: "workingHoursSaturday",
  };

  const todaySettings = settings[dayMap[dayOfWeek]];

  if (!todaySettings.enabled) {
    return false;
  }

  return todaySettings.ranges.some(
    (range) =>
      currentMinutes >= range.fromMinutes && currentMinutes <= range.toMinutes,
  );
}

export function checkInWorkingHours(): boolean {
  return checkInWorkingHoursAt(moment(), getSettings());
}

enum IdleState {
  Active = "active",
  Idle = "idle",
  Locked = "locked",
  Unknown = "unknown",
}

export function checkIdle(): boolean {
  const settings: Settings = getSettings();

  const state: IdleState = powerMonitor.getSystemIdleState(
    getIdleResetSeconds(),
  ) as IdleState;

  if (state === IdleState.Locked) {
    if (!lockStart) {
      lockStart = new Date();
      return false;
    } else {
      const lockSeconds = Number(
        ((+new Date() - +lockStart) / 1000).toFixed(0),
      );
      return lockSeconds > getIdleResetSeconds();
    }
  }

  lockStart = null;

  if (!settings.idleResetEnabled) {
    return false;
  }

  return state === IdleState.Idle;
}

function isSystemIdle(): boolean {
  const state: IdleState = powerMonitor.getSystemIdleState(
    getIdleResetSeconds(),
  ) as IdleState;

  if (state === IdleState.Locked) {
    if (!lockStart) {
      lockStart = new Date();
      return false;
    }

    const lockSeconds = Number(((+new Date() - +lockStart) / 1000).toFixed(0));
    return lockSeconds > getIdleResetSeconds();
  }

  lockStart = null;
  return state === IdleState.Idle;
}

function pauseSittingTimer(reason: string): void {
  if (pausedRemainingSeconds !== null) {
    breakTime = null;
    return;
  }

  if (!breakTime) {
    return;
  }

  const idleResetSeconds = getIdleResetSeconds();
  const secondsSinceLastTick = lastTick
    ? Math.abs(Date.now() - lastTick.getTime()) / 1000
    : 0;
  const reference =
    lastTick && secondsSinceLastTick > idleResetSeconds
      ? moment(lastTick)
      : moment();

  pausedRemainingSeconds = Math.max(0, breakTime.diff(reference, "seconds"));
  breakTime = null;
  log.info(
    `Sitting timer paused [${reason}] [remaining=${pausedRemainingSeconds}s]`,
  );
  buildTray();
}

function resumeSittingTimer(): void {
  if (pausedRemainingSeconds === null) {
    return;
  }

  const remaining = pausedRemainingSeconds;
  pausedRemainingSeconds = null;

  if (remaining <= 0) {
    breakTime = moment();
    log.info("Sitting timer resumed [remaining=0s]");
    doBreak();
    return;
  }

  breakTime = moment().add(remaining, "seconds");
  log.info(`Sitting timer resumed [remaining=${remaining}s]`);
  buildTray();
}

export function isHavingBreak(): boolean {
  return havingBreak;
}

function checkShouldHaveBreak(): boolean {
  const settings: Settings = getSettings();
  const inWorkingHours = checkInWorkingHours();
  const idle = checkIdle();

  return !havingBreak && settings.breaksEnabled && inWorkingHours && !idle;
}

function checkBreak(): void {
  const now = moment();

  if (breakTime !== null && now > breakTime) {
    doBreak();
  }
}

export function startBreakNow(): void {
  clearSittingPause();
  startedFromTray = true;
  breakTime = moment();
  doBreak();
}

export function wasStartedFromTray(): boolean {
  return startedFromTray;
}

function tick(): void {
  try {
    const settings = getSettings();
    const now = moment();
    const inWorkingHours = checkInWorkingHoursAt(now, settings);
    const wasInWorkingHours = lastTick
      ? checkInWorkingHoursAt(moment(lastTick), settings)
      : inWorkingHours;

    if (!wasInWorkingHours && inWorkingHours) {
      resetTimeSinceLastBreak("Reset time since last break [working-hours]");
    }

    const shouldHaveBreak = checkShouldHaveBreak();
    const reminderSitting = isReminderMode(settings) && !havingBreak;

    // This can happen if the computer is put to sleep. In this case, we want
    // to skip the break if the time the computer was unresponsive was greater
    // than the idle reset.
    const secondsSinceLastTick = lastTick
      ? Math.abs(+new Date() - +lastTick) / 1000
      : 0;
    const breakSeconds = getBreakSeconds();
    const lockSeconds = lockStart && Math.abs(+new Date() - +lockStart) / 1000;

    if (!reminderSitting) {
      if (secondsSinceLastTick > breakSeconds) {
        // The computer has been slept for longer than the break period. In this
        // case, it's not particularly helpful to show an idle reset
        // notification, so just reset the break
        lockStart = null;
        breakTime = null;
        resetTimeSinceLastBreak("Break auto-detected via system suspension");
      } else if (
        lockStart &&
        lockSeconds !== null &&
        lockSeconds > breakSeconds
      ) {
        // The computer has been locked for longer than the break period. In this
        // case, it's not particularly helpful to show an idle reset
        // notification, so unset idle start
        idleStart = null;
        lockStart = null;
      } else if (secondsSinceLastTick > getIdleResetSeconds()) {
        //  If idleStart exists, it means we were idle before the computer slept.
        //  If it doesn't exist, count the computer going unresponsive as the
        //  start of the idle period.
        if (!idleStart) {
          lockStart = null;
          idleStart = lastTick;
        }
        scheduleNextBreak();
      }
    }

    if (reminderSitting && settings.breaksEnabled) {
      if (!inWorkingHours) {
        clearSittingPause();
        if (breakTime) {
          breakTime = null;
          buildTray();
        }
        return;
      }

      const idle = isSystemIdle();
      const slept = secondsSinceLastTick > getIdleResetSeconds();

      if (idle || slept) {
        pauseSittingTimer(idle ? "idle" : "system suspension");
      }

      if (idle) {
        return;
      }

      if (pausedRemainingSeconds !== null) {
        resumeSittingTimer();
        return;
      }
    }

    if (!shouldHaveBreak && !havingBreak && breakTime) {
      if (checkIdle()) {
        const idleResetSeconds = getIdleResetSeconds();
        // Calculate when idle actually started by subtracting idle duration
        idleStart = new Date(Date.now() - idleResetSeconds * 1000);
      }
      breakTime = null;
      buildTray();
      return;
    }

    if (shouldHaveBreak && !breakTime) {
      scheduleNextBreak();
      return;
    }

    if (shouldHaveBreak) {
      checkBreak();
    }
  } finally {
    lastTick = new Date();
  }
}

let tickInterval: NodeJS.Timeout;

export function initBreaks(systemIdleMonitor?: SystemIdleMonitor): void {
  powerMonitor = systemIdleMonitor ?? require("electron").powerMonitor;
  clearSittingPause();

  const settings: Settings = getSettings();

  if (settings.breaksEnabled) {
    scheduleNextBreak();
  }

  if (tickInterval) {
    clearInterval(tickInterval);
  }

  tickInterval = setInterval(tick, 1000);
}
