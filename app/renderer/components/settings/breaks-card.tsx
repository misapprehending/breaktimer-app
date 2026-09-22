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

export default function BreaksCard({
  settingsDraft,
  onNotificationTypeChange,
  onDateChange,
  onTextChange,
  onSwitchChange,
}: BreaksCardProps) {
  const isReminder =
    settingsDraft.notificationType === NotificationType.Reminder;

  return (
    <SettingsCard
      title="Breaks"
      helperText={
        isReminder
          ? "A non-blocking reminder to stand, then a tiny countdown while you stay standing."
          : undefined
      }
      toggle={{
        checked: settingsDraft.breaksEnabled,
        onCheckedChange: (checked) => onSwitchChange("breaksEnabled", checked),
      }}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type</Label>
            <Select
              value={settingsDraft.notificationType}
              onValueChange={onNotificationTypeChange}
              disabled={!settingsDraft.breaksEnabled}
            >
              <SelectTrigger style={{ width: 165 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NotificationType.Popup}>
                  Popup break
                </SelectItem>
                <SelectItem value={NotificationType.Reminder}>
                  Reminder overlay
                </SelectItem>
                <SelectItem value={NotificationType.Notification}>
                  Simple notification
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isReminder ? "Seated time" : "Frequency"}
            </Label>
            <TimeInput
              precision="seconds"
              value={settingsDraft.breakFrequencySeconds}
              onChange={(seconds) => {
                const date = new Date();
                date.setHours(Math.floor(seconds / 3600));
                date.setMinutes(Math.floor((seconds % 3600) / 60));
                date.setSeconds(seconds % 60);
                onDateChange("breakFrequency", date);
              }}
              disabled={!settingsDraft.breaksEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isReminder ? "Standing time" : "Length"}
            </Label>
            <TimeInput
              precision="seconds"
              value={settingsDraft.breakLengthSeconds}
              onChange={(seconds) => {
                const date = new Date();
                date.setHours(Math.floor(seconds / 3600));
                date.setMinutes(Math.floor((seconds % 3600) / 60));
                date.setSeconds(seconds % 60);
                onDateChange("breakLength", date);
              }}
              disabled={
                !settingsDraft.breaksEnabled ||
                !usesBreakWindows(settingsDraft.notificationType)
              }
            />
          </div>
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
              isReminder
                ? "Optional note shown in the stand reminder..."
                : "Enter your break message..."
            }
          />
        </div>
      </div>
    </SettingsCard>
  );
}
