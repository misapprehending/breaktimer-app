# LAQ BreakTimer

Legal Aid Queensland fork of [BreakTimer](https://github.com/tom-james-watson/breaktimer-app). It keeps the same break-reminder behaviour, with LAQ colours and an Intune-ready Windows installer.

Updates are **manual**: build a new installer, then deploy it with Intune. The app does not check GitHub or auto-update itself.

Upstream BreakTimer is GPL-3.0-or-later software by Tom Watson. This fork preserves that license.

## Brand colours

Defaults are taken from [legalaid.qld.gov.au](https://www.legalaid.qld.gov.au):

| Token      | Hex       | Use                                          |
| ---------- | --------- | -------------------------------------------- |
| Teal       | `#0F8291` | Break overlay, settings primary, Reset Theme |
| White      | `#FFFFFF` | Break overlay text                           |
| Navy       | `#002742` | Supporting UI contrast                       |
| Light teal | `#3DACBA` | Dark-mode primary                            |

Existing installs that still have the upstream default `#16a085` are migrated to `#0F8291` on first launch.

## Versioning and builds

The version shown in Settings, the tray menu, and About is `version` from `package.json`. Electron stamps that into the Windows file version, which Intune can detect.

1. Bump `version` in `package.json` (for example `2.1.0` → `2.1.1`).
2. Build the installer:

   ```bash
   npm run package-win
   ```

   Output: `release/LAQBreakTimer-Setup-<version>.exe`

3. Tagging `v*` also runs `.github/workflows/release.yml`, which publishes that installer as a GitHub Release for IT to download. The app does not consume the release.

On a Windows builder with WiX, you can also wrap the NSIS installer as an MSI:

```bash
npm run package-win-intune
```

## Intune (manual updates)

The Windows target is a per-machine NSIS installer. It does not launch the app at the end of setup.

Wrap `LAQBreakTimer-Setup-<version>.exe` with the [Microsoft Win32 Content Prep Tool](https://learn.microsoft.com/en-us/intune/intune-service/apps/apps-win32-app-management).

| Field     | Value                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Install   | `LAQBreakTimer-Setup-2.1.0.exe /S`                                                                    |
| Uninstall | `"C:\Program Files\LAQ BreakTimer\Uninstall LAQ BreakTimer.exe" /S`                                   |
| Detection | File `C:\Program Files\LAQ BreakTimer\LAQBreakTimer.exe` version **greater than or equal to** `2.1.0` |
| Context   | System                                                                                                |

To ship a new version:

1. Build `LAQBreakTimer-Setup-<new-version>.exe`.
2. Create a new Win32 app (or replace the package) with install command and detection version set to the new version.
3. **Supersede** the previous Win32 app so Intune replaces it. Do not rely on the app to update itself.

### MSI-wrapped LOB

`package-win-intune` produces `LAQBreakTimer-<version>.msi`:

```text
msiexec /i LAQBreakTimer-2.1.0.msi /qn /norestart
```

## Features

Customize:

- How long your breaks are and how often you wish to have them
- Whether to be reminded with a simple notification or a fullscreen break window
- Working hours so you are only reminded when you want to be
- The content of messages shown during breaks
- Whether to restart the break countdown when the computer is idle

## Logs and data

Linux: `/home/<USERNAME>/.config/LAQ BreakTimer`

macOS: `/Users/<USERNAME>/Library/Application Support/LAQ BreakTimer`

Windows: `C:\Users\<USERNAME>\AppData\Roaming\LAQ BreakTimer`

Logs are in a `logs/main.log` folder under that path.

## Development

See [./DEVELOPMENT.md](DEVELOPMENT.md).
