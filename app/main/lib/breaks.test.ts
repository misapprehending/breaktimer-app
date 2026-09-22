import type { PowerMonitor } from "electron";
import moment from "moment";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultSettings,
  NotificationType,
  Settings,
} from "../../types/settings";

const harness = vi.hoisted(() => ({
  buildTray: vi.fn(),
  createBreakWindows: vi.fn(),
  getSystemIdleState: vi.fn<PowerMonitor["getSystemIdleState"]>(() => "active"),
  powerMonitor: {} as Pick<PowerMonitor, "getSystemIdleState">,
  settings: {} as Settings,
}));

vi.mock("electron", () => ({}));
vi.mock("electron-log", () => ({ default: { info: vi.fn() } }));
vi.mock("./ipc", () => ({ sendIpc: vi.fn() }));
vi.mock("./notifications", () => ({ showNotification: vi.fn() }));
vi.mock("./store", () => ({ getSettings: () => harness.settings }));
vi.mock("./tray", () => ({ buildTray: harness.buildTray }));
vi.mock("./windows", () => ({
  createBreakWindows: harness.createBreakWindows,
}));

describe("manual breaks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    harness.settings = {
      ...defaultSettings,
      notificationType: NotificationType.Popup,
    };
  });

  it("starts immediately without waiting for the automatic scheduler", async () => {
    const breaks = await import("./breaks.js");

    breaks.startBreakNow();

    expect(harness.createBreakWindows).toHaveBeenCalledOnce();
    expect(breaks.isHavingBreak()).toBe(true);
    expect(breaks.wasStartedFromTray()).toBe(true);
    expect(
      Math.abs(breaks.getBreakTime()?.diff(moment()) ?? Infinity),
    ).toBeLessThan(1000);
  });
});

describe("system suspension", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T09:00:00Z"));
    vi.resetModules();
    vi.clearAllMocks();
    harness.getSystemIdleState.mockReturnValue("active");
    harness.powerMonitor = {
      getSystemIdleState: harness.getSystemIdleState,
    };
    harness.settings = {
      ...defaultSettings,
      breakFrequencySeconds: 60,
      idleResetLengthSeconds: 5,
      workingHoursEnabled: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not count a long suspension as active time", async () => {
    const breaks = await import("./breaks.js");
    breaks.initBreaks(harness.powerMonitor);
    vi.advanceTimersByTime(1000);

    vi.setSystemTime(new Date("2026-08-24T09:02:00Z"));
    vi.advanceTimersByTime(1000);

    expect(breaks.getTimeSinceLastCompletedBreak()).toBe(0);
    expect(breaks.getBreakTime()?.diff(moment(), "seconds")).toBe(60);
  });

  it("detects suspension even if the machine was already locked", async () => {
    harness.getSystemIdleState.mockReturnValue("locked");
    const breaks = await import("./breaks.js");
    breaks.initBreaks(harness.powerMonitor);
    vi.advanceTimersByTime(1000);

    vi.setSystemTime(new Date("2026-08-24T09:02:00Z"));
    vi.advanceTimersByTime(1000);

    expect(breaks.getTimeSinceLastCompletedBreak()).toBe(0);
  });
});

describe("reminder sitting idle pause", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T09:00:00Z"));
    vi.resetModules();
    vi.clearAllMocks();
    harness.getSystemIdleState.mockReturnValue("active");
    harness.powerMonitor = {
      getSystemIdleState: harness.getSystemIdleState,
    };
    harness.settings = {
      ...defaultSettings,
      notificationType: NotificationType.Reminder,
      breakFrequencySeconds: 60,
      breakLengthSeconds: 20,
      idleResetLengthSeconds: 5,
      idleResetEnabled: false,
      workingHoursEnabled: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates overlay windows for reminder mode", async () => {
    const breaks = await import("./breaks.js");

    breaks.startBreakNow();

    expect(harness.createBreakWindows).toHaveBeenCalledOnce();
    expect(breaks.isHavingBreak()).toBe(true);
  });

  it("pauses remaining seated time while idle and resumes it", async () => {
    const breaks = await import("./breaks.js");
    breaks.initBreaks(harness.powerMonitor);
    vi.advanceTimersByTime(20_000);

    expect(breaks.getBreakTime()?.diff(moment(), "seconds")).toBe(40);

    harness.getSystemIdleState.mockReturnValue("idle");
    vi.advanceTimersByTime(1_000);

    expect(breaks.isSittingTimerPaused()).toBe(true);
    expect(breaks.getPausedRemainingSeconds()).toBeGreaterThanOrEqual(39);
    expect(breaks.getPausedRemainingSeconds()).toBeLessThanOrEqual(40);
    expect(breaks.getBreakTime()).toBeNull();
    expect(breaks.isHavingBreak()).toBe(false);
    expect(breaks.getTimeSinceLastCompletedBreak()).toBeGreaterThan(0);

    vi.advanceTimersByTime(15_000);
    expect(breaks.getPausedRemainingSeconds()).toBeGreaterThanOrEqual(39);
    expect(breaks.getPausedRemainingSeconds()).toBeLessThanOrEqual(40);

    harness.getSystemIdleState.mockReturnValue("active");
    vi.advanceTimersByTime(1_000);

    expect(breaks.isSittingTimerPaused()).toBe(false);
    expect(
      breaks.getBreakTime()?.diff(moment(), "seconds"),
    ).toBeGreaterThanOrEqual(39);
    expect(
      breaks.getBreakTime()?.diff(moment(), "seconds"),
    ).toBeLessThanOrEqual(40);
    expect(harness.createBreakWindows).not.toHaveBeenCalled();
  });

  it("does not treat idle as a completed sit interval", async () => {
    const breaks = await import("./breaks.js");
    breaks.initBreaks(harness.powerMonitor);
    vi.advanceTimersByTime(10_000);

    harness.getSystemIdleState.mockReturnValue("idle");
    vi.advanceTimersByTime(1_000);

    expect(breaks.getTimeSinceLastCompletedBreak()).toBeGreaterThan(5);
    expect(breaks.getPausedRemainingSeconds()).not.toBeNull();
  });

  it("pauses seated time across system suspension", async () => {
    const breaks = await import("./breaks.js");
    breaks.initBreaks(harness.powerMonitor);
    vi.advanceTimersByTime(1000);

    vi.setSystemTime(new Date("2026-08-24T09:02:00Z"));
    vi.advanceTimersByTime(1000);

    expect(breaks.getTimeSinceLastCompletedBreak()).toBeGreaterThan(0);
    expect(breaks.isSittingTimerPaused()).toBe(false);
    const remaining = breaks.getBreakTime()?.diff(moment(), "seconds") ?? -1;
    expect(remaining).toBeGreaterThanOrEqual(58);
    expect(remaining).toBeLessThanOrEqual(60);
  });

  it("counts a short standing session as complete", async () => {
    const breaks = await import("./breaks.js");
    breaks.startBreakNow();

    breaks.completeBreakTracking(1000);

    expect(breaks.getTimeSinceLastCompletedBreak()).toBe(0);
  });
});

describe("popup idle reset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T09:00:00Z"));
    vi.resetModules();
    vi.clearAllMocks();
    harness.getSystemIdleState.mockReturnValue("active");
    harness.powerMonitor = {
      getSystemIdleState: harness.getSystemIdleState,
    };
    harness.settings = {
      ...defaultSettings,
      notificationType: NotificationType.Popup,
      breakFrequencySeconds: 60,
      idleResetLengthSeconds: 5,
      idleResetEnabled: true,
      workingHoursEnabled: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("still auto-resets popup breaks after idle", async () => {
    const breaks = await import("./breaks.js");
    breaks.initBreaks(harness.powerMonitor);
    vi.advanceTimersByTime(20_000);

    harness.getSystemIdleState.mockReturnValue("idle");
    vi.advanceTimersByTime(1_000);

    expect(breaks.getBreakTime()).toBeNull();
    expect(breaks.isSittingTimerPaused()).toBe(false);

    harness.getSystemIdleState.mockReturnValue("active");
    vi.advanceTimersByTime(1_000);

    expect(breaks.getTimeSinceLastCompletedBreak()).toBe(0);
    expect(breaks.getBreakTime()?.diff(moment(), "seconds")).toBe(60);
  });
});
