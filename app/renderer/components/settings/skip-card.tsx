import { Settings, isDeskReminderType } from "../../../types/settings";
import SettingsCard from "./settings-card";

interface SkipCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
}

export default function SkipCard({
  settingsDraft,
  onSwitchChange,
}: SkipCardProps) {
  return (
    <SettingsCard
      title="Skip"
      helperText={
        isDeskReminderType(settingsDraft.notificationType)
          ? "Allow skipping this stand reminder and starting a new seated interval."
          : "Allow skipping breaks entirely without rescheduling them."
      }
      toggle={{
        checked:
          settingsDraft.skipBreakEnabled &&
          !settingsDraft.immediatelyStartBreaks,
        onCheckedChange: (checked) =>
          onSwitchChange("skipBreakEnabled", checked),
        disabled: settingsDraft.immediatelyStartBreaks,
      }}
    />
  );
}
