import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import {
  NotificationType,
  Settings,
  SoundType,
  isDeskReminderType,
  usesMovePhase,
} from "../../types/settings";
import { BreakNotification } from "./break/break-notification";
import { BreakProgress } from "./break/break-progress";
import { isPrimaryBreakWindow } from "./break/break-window";
import { createDarkerRgba } from "./break/utils";

export default function Break() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [countingDown, setCountingDown] = useState(true);
  const [allowPostpone, setAllowPostpone] = useState<boolean | null>(null);
  const [timeSinceLastBreak, setTimeSinceLastBreak] = useState<number | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sharedBreakEndTime, setSharedBreakEndTime] = useState<number | null>(
    null,
  );
  const [hudPhase, setHudPhase] = useState<"stand" | "move">("stand");

  useEffect(() => {
    const init = async () => {
      const [allowPostpone, settings, timeSince, startedFromTray] =
        await Promise.all([
          ipcRenderer.invokeGetAllowPostpone(),
          ipcRenderer.invokeGetSettings() as Promise<Settings>,
          ipcRenderer.invokeGetTimeSinceLastBreak(),
          ipcRenderer.invokeWasStartedFromTray(),
        ]);

      setAllowPostpone(allowPostpone);
      setSettings(settings);
      setTimeSinceLastBreak(timeSince);

      // Skip the countdown if immediately start breaks is enabled or started from tray.
      // Desk reminders always wait for an explicit stand confirmation.
      if (
        startedFromTray ||
        (settings.immediatelyStartBreaks &&
          !isDeskReminderType(settings.notificationType))
      ) {
        setCountingDown(false);
      }

      setReady(true);
    };

    const handleBreakStart = (breakEndTime: number) => {
      setHudPhase("stand");
      setSharedBreakEndTime(breakEndTime);
      setCountingDown(false);
    };

    const handleBreakMoveStart = (breakEndTime: number) => {
      setHudPhase("move");
      setSharedBreakEndTime(breakEndTime);
      setCountingDown(false);
    };

    const handleBreakEnd = () => {
      setClosing(true);
    };

    ipcRenderer.onBreakStart(handleBreakStart);
    ipcRenderer.onBreakMoveStart(handleBreakMoveStart);
    ipcRenderer.onBreakEnd(handleBreakEnd);

    // Delay or the window displays incorrectly.
    // FIXME: work out why and how to avoid this.
    setTimeout(init, 1000);
  }, []);

  const handleCountdownOver = useCallback(async () => {
    // Every display has a break window. Start tracking once, then rely on the
    // main process to broadcast the shared break timeline to every window.
    if (isPrimaryBreakWindow(window.location.search)) {
      await ipcRenderer.invokeBreakStart();
    }
  }, []);

  const handleStartBreakNow = useCallback(async () => {
    await ipcRenderer.invokeBreakStart();
  }, []);

  useEffect(() => {
    if (!countingDown) {
      ipcRenderer.invokeBreakWindowResize();
    }
  }, [countingDown]);

  useEffect(() => {
    if (closing) {
      setTimeout(() => {
        window.close();
      }, 500);
    }
  }, [closing]);

  const handlePostponeBreak = useCallback(async () => {
    await ipcRenderer.invokeBreakPostpone("snoozed");
    setClosing(true);
  }, []);

  const handleSkipBreak = useCallback(async () => {
    await ipcRenderer.invokeBreakPostpone("skipped");
    setClosing(true);
  }, []);

  const handleEndBreak = useCallback(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const windowId = urlParams.get("windowId");
    const isPrimary = windowId === "0" || windowId === null;

    if (isPrimary && settings && settings?.soundType !== SoundType.None) {
      ipcRenderer.invokeEndSound(settings.soundType, settings.breakSoundVolume);
    }

    await ipcRenderer.invokeBreakEnd();
  }, [settings]);

  const handleHudFinished = useCallback(async () => {
    if (
      settings &&
      usesMovePhase(settings.notificationType) &&
      hudPhase === "stand"
    ) {
      if (isPrimaryBreakWindow(window.location.search)) {
        await ipcRenderer.invokeBreakMoveStart();
      }
      return;
    }

    await handleEndBreak();
  }, [handleEndBreak, hudPhase, settings]);

  if (settings === null || allowPostpone === null) {
    return null;
  }

  const isDeskReminder = isDeskReminderType(settings.notificationType);

  if (countingDown) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ backgroundColor: "transparent" }}
      >
        {ready && !closing && (
          <BreakNotification
            onCountdownOver={handleCountdownOver}
            onPostponeBreak={handlePostponeBreak}
            onSkipBreak={handleSkipBreak}
            onStartBreakNow={handleStartBreakNow}
            postponeBreakEnabled={
              settings.postponeBreakEnabled &&
              allowPostpone &&
              (isDeskReminder || !settings.immediatelyStartBreaks)
            }
            skipBreakEnabled={
              settings.skipBreakEnabled &&
              (isDeskReminder || !settings.immediatelyStartBreaks)
            }
            timeSinceLastBreak={timeSinceLastBreak}
            textColor={settings.textColor}
            backgroundColor={settings.backgroundColor}
            waitForConfirm={isDeskReminder}
            title={isDeskReminder ? settings.breakTitle : undefined}
            confirmLabel={isDeskReminder ? "Stand" : "Start"}
            timeSinceNoun={isDeskReminder ? "stand" : "break"}
          />
        )}
      </div>
    );
  }

  if (isDeskReminder) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <motion.div
          className="h-full w-full rounded-xl overflow-hidden"
          animate={{ opacity: closing ? 0 : 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            color: settings.textColor,
            backgroundColor: settings.backgroundColor,
          }}
        >
          {ready && (
            <BreakProgress
              key={`${hudPhase}-${sharedBreakEndTime ?? "local"}`}
              breakMessage={settings.breakMessage}
              breakTitle={settings.breakTitle}
              endBreakEnabled={settings.endBreakEnabled}
              onEndBreak={handleEndBreak}
              onCountdownComplete={handleHudFinished}
              settings={settings}
              textColor={settings.textColor}
              isClosing={closing}
              sharedBreakEndTime={sharedBreakEndTime}
              variant="hud"
              playStartSound={false}
              hudLabel={hudPhase === "move" ? "Moving" : "Standing"}
              endButtonLabel={hudPhase === "move" ? "Done" : "Sit"}
              completeTrackingOnEnd={
                hudPhase === "move" ||
                settings.notificationType !== NotificationType.TwentyEightTwo
              }
            />
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center relative">
      {settings.showBackdrop && (
        <motion.div
          className="absolute inset-0"
          animate={{
            opacity: closing ? 0 : settings.backdropOpacity,
          }}
          initial={{ opacity: 0 }}
          transition={{
            duration: 0.5,
            delay: closing ? 0.3 : 0,
          }}
          style={{
            backgroundColor: createDarkerRgba(settings.backgroundColor, 1),
          }}
        />
      )}
      <motion.div
        className="flex flex-col justify-center items-center relative p-6 text-balance focus:outline-none w-[500px] rounded-xl"
        animate={{
          opacity: closing ? 0 : 1,
          y: closing ? -20 : 0,
        }}
        initial={{ opacity: 0, y: -20 }}
        transition={{
          duration: 0.5,
          ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuart
        }}
        style={{
          color: settings.textColor,
          backgroundColor: settings.backgroundColor,
        }}
      >
        {ready && (
          <BreakProgress
            breakMessage={settings.breakMessage}
            breakTitle={settings.breakTitle}
            endBreakEnabled={settings.endBreakEnabled}
            onEndBreak={handleEndBreak}
            settings={settings}
            textColor={settings.textColor}
            isClosing={closing}
            sharedBreakEndTime={sharedBreakEndTime}
          />
        )}
      </motion.div>
    </div>
  );
}
