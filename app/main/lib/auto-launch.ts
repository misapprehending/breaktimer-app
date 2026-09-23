import AutoLaunch from "auto-launch";
import { APP_NAME } from "../../types/branding";

let app = { name: APP_NAME };

if (process.env.APPIMAGE) {
  app = Object.assign(app, { path: process.env.APPIMAGE });
}

const AppLauncher = new AutoLaunch(app);

export function setAutoLauch(autoLaunch: boolean): void {
  if (process.env.NODE_ENV !== "development") {
    if (autoLaunch) {
      AppLauncher.enable();
    } else {
      AppLauncher.disable();
    }
  }
}
