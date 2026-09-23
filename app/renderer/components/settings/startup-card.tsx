import { APP_NAME } from "../../../types/branding";
import { Settings } from "../../../types/settings";
import SettingsCard from "./settings-card";

interface StartupCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
}

export default function StartupCard({
  settingsDraft,
  onSwitchChange,
}: StartupCardProps) {
  return (
    <SettingsCard
      title="Start at login"
      helperText={`Automatically start ${APP_NAME} when you log into your computer.`}
      toggle={{
        checked: settingsDraft.autoLaunch,
        onCheckedChange: (checked) => onSwitchChange("autoLaunch", checked),
      }}
    />
  );
}
