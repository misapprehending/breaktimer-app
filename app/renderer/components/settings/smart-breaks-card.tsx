import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, isDeskReminderType } from "../../../types/settings";
import SettingsCard from "./settings-card";
import TimeInput from "./time-input";

interface SmartBreaksCardProps {
  settingsDraft: Settings;
  onSwitchChange: (field: string, checked: boolean) => void;
  onDateChange: (fieldName: string, newVal: Date) => void;
}

export default function SmartBreaksCard({
  settingsDraft,
  onSwitchChange,
  onDateChange,
}: SmartBreaksCardProps) {
  const isReminder = isDeskReminderType(settingsDraft.notificationType);

  return (
    <SettingsCard
      title={isReminder ? "Idle pause" : "Smart Breaks"}
      helperText={
        isReminder
          ? "Pause the seated timer when you are idle. It resumes with the remaining time when you return."
          : "Automatically detect natural breaks and reset the break timer."
      }
      toggle={
        isReminder
          ? undefined
          : {
              checked: settingsDraft.idleResetEnabled,
              onCheckedChange: (checked) =>
                onSwitchChange("idleResetEnabled", checked),
            }
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Minimum idle time</Label>
          <TimeInput
            precision="seconds"
            value={settingsDraft.idleResetLengthSeconds}
            onChange={(seconds) => {
              const date = new Date();
              date.setHours(Math.floor(seconds / 3600));
              date.setMinutes(Math.floor((seconds % 3600) / 60));
              date.setSeconds(seconds % 60);
              onDateChange("idleResetLength", date);
            }}
            disabled={!isReminder && !settingsDraft.idleResetEnabled}
          />
        </div>
        {!isReminder && (
          <div className="flex items-center space-x-2">
            <Switch
              checked={settingsDraft.idleResetNotification}
              onCheckedChange={(checked) =>
                onSwitchChange("idleResetNotification", checked)
              }
              disabled={!settingsDraft.idleResetEnabled}
            />
            <Label>Show notification when break automatically detected</Label>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
