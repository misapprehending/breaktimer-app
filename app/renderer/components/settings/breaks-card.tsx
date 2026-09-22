import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  NotificationType,
  Settings,
  usesBreakWindows,
} from "../../../types/settings";
import SettingsCard from "./settings-card";
import TimeInput from "./time-input";

interface BreaksCardProps {
  settingsDraft: Settings;
  onNotificationTypeChange: (value: string) => void;
  onDateChange: (fieldName: string, newVal: Date) => void;
  onTextChange: (
    field: string,
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSwitchChange: (field: string, checked: boolean) => void;
}

function secondsToDate(seconds: number): Date {
  const date = new Date();
  date.setHours(Math.floor(seconds / 3600));
  date.setMinutes(Math.floor((seconds % 3600) / 60));
  date.setSeconds(seconds % 60);
  return date;
}

export default function BreaksCard({
  settingsDraft,
  onNotificationTypeChange,
  onDateChange,
  onTextChange,
  onSwitchChange,
}: BreaksCardProps) {
  const isSitStand =
    settingsDraft.notificationType === NotificationType.Reminder;
  const isTwentyEightTwo =
    settingsDraft.notificationType === NotificationType.TwentyEightTwo;
  const isDeskReminder = isSitStand || isTwentyEightTwo;

  const helperText = isTwentyEightTwo
    ? "Sit, stand, then move. Defaults to 20 minutes sitting, 8 standing, and 2 moving."
    : isSitStand
      ? "Stay at the computer and switch between sitting and standing on a timer."
      : "Sit-stand desk is a posture timer. 20-8-2 adds a short move break after standing.";

  return (
    <SettingsCard
      title="Breaks"
      helperText={helperText}
      toggle={{
        checked: settingsDraft.breaksEnabled,
        onCheckedChange: (checked) => onSwitchChange("breaksEnabled", checked),
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Type</Label>
          <Select
            value={settingsDraft.notificationType}
            onValueChange={onNotificationTypeChange}
            disabled={!settingsDraft.breaksEnabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NotificationType.Popup}>
                Popup break
              </SelectItem>
              <SelectItem value={NotificationType.Reminder}>
                Sit-stand desk
              </SelectItem>
              <SelectItem value={NotificationType.TwentyEightTwo}>
                20-8-2
              </SelectItem>
              <SelectItem value={NotificationType.Notification}>
                Simple notification
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div
          className={`grid gap-4 ${isTwentyEightTwo ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isDeskReminder ? "Seated time" : "Frequency"}
            </Label>
            <TimeInput
              precision="seconds"
              value={settingsDraft.breakFrequencySeconds}
              onChange={(seconds) =>
                onDateChange("breakFrequency", secondsToDate(seconds))
              }
              disabled={!settingsDraft.breaksEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isDeskReminder ? "Standing time" : "Length"}
            </Label>
            <TimeInput
              precision="seconds"
              value={settingsDraft.breakLengthSeconds}
              onChange={(seconds) =>
                onDateChange("breakLength", secondsToDate(seconds))
              }
              disabled={
                !settingsDraft.breaksEnabled ||
                !usesBreakWindows(settingsDraft.notificationType)
              }
            />
          </div>
          {isTwentyEightTwo && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Moving time</Label>
              <TimeInput
                precision="seconds"
                value={settingsDraft.moveLengthSeconds}
                onChange={(seconds) =>
                  onDateChange("moveLength", secondsToDate(seconds))
                }
                disabled={!settingsDraft.breaksEnabled}
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Title</Label>
          <Input
            id="break-title"
            className="text-sm"
            value={settingsDraft.breakTitle}
            onChange={onTextChange.bind(null, "breakTitle")}
            disabled={!settingsDraft.breaksEnabled}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Message</Label>
          <Textarea
            id="break-message"
            className="text-sm resize-none"
            rows={3}
            value={settingsDraft.breakMessage}
            onChange={onTextChange.bind(null, "breakMessage")}
            disabled={!settingsDraft.breaksEnabled}
            placeholder={
              isDeskReminder
                ? "Optional note shown in the stand reminder..."
                : "Enter your break message..."
            }
          />
        </div>
      </div>
    </SettingsCard>
  );
}
