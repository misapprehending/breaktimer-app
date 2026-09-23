import { app } from "electron";
import electronDebug from "electron-debug";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { APP_ID, GITHUB_RELEASES_URL } from "../types/branding";
import { setAutoLauch } from "./lib/auto-launch";
import { initBreaks } from "./lib/breaks";
import "./lib/ipc";
import { getAppInitialized } from "./lib/store";
import { initTray } from "./lib/tray";
import { createSettingsWindow, createSoundsWindow } from "./lib/windows";

const gotTheLock = app.requestSingleInstanceLock();

app.on("second-instance", (event, commandLine, workingDirectory) => {
  log.info("Second instance detected, opening settings window");
  log.info(`Command line: ${commandLine}`);
  log.info(`Working directory: ${workingDirectory}`);
  createSettingsWindow();
});

app.on("activate", () => {
  log.info("App activated, opening settings window");
  createSettingsWindow();
});

if (!gotTheLock) {
  log.info("App already running");
  app.exit();
}

function configureAutoUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    log.error(`Auto updater error: ${error}`);
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info);
  });
}

function checkForUpdates(): void {
  log.info("Checking for updates...");
  configureAutoUpdater();

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    log.error(`Unable to run auto updater: ${error}`);
    log.error(`Releases: ${GITHUB_RELEASES_URL}`);
  });
}

if (process.env.NODE_ENV === "production") {
  const sourceMapSupport = require("source-map-support");
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === "development" ||
  process.env.DEBUG_PROD === "true"
) {
  electronDebug();
}

// Don't exit on close all windows - live in tray
app.on("window-all-closed", () => {
  // Pass
});

app.on("ready", async () => {
  if (
    process.env.NODE_ENV === "development" ||
    process.env.DEBUG_PROD === "true"
  ) {
    // Extensions are broken on electron 10
    // await installExtensions()
  }

  // Required for notifications to work on windows
  if (process.platform === "win32") {
    app.setAppUserModelId(APP_ID);
  }

  if (process.platform === "darwin") {
    app.dock?.hide();
  }

  const appInitialized = getAppInitialized();

  if (!appInitialized) {
    if (process.env.NODE_ENV !== "development") {
      setAutoLauch(true);
    }
    // Show settings window on first launch instead of notification
    createSettingsWindow();
    // Don't set app as initialized yet - we'll do that after the user dismisses the modal
  } else {
    // App has been initialized before, don't show settings automatically
  }

  initBreaks();
  initTray();
  createSoundsWindow();

  if (process.env.NODE_ENV !== "development") {
    checkForUpdates();
  }
});
