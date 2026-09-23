# LAQ BreakTimer

Legal Aid Queensland fork of [BreakTimer](https://github.com/tom-james-watson/breaktimer-app). It keeps the same break-reminder behaviour, with LAQ colours, GitHub auto-update, and an Intune-ready Windows installer.

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

## Auto-update

Windows, macOS, and Linux check [GitHub Releases](https://github.com/misapprehending/breaktimer-app/releases) on startup via `electron-updater`.

1. Bump `version` in `package.json`.
2. Tag and push, for example `git tag v2.1.1 && git push origin v2.1.1`.
3. The **Release** workflow publishes `LAQBreakTimer-Setup-<version>.exe` and `latest.yml`.
4. Installed apps download that release and apply it on quit.

The GitHub repo must be **public** (or you must ship a token) for update checks to succeed. Windows builds are unsigned, so `publisherName` is omitted and electron-updater skips Authenticode checks. After you add a code-signing certificate, set `build.win.publisherName` to the certificate CN so updates verify the publisher.

## Intune

The Windows target is NSIS, configured for silent enterprise install. GitHub auto-update still works because the payload is NSIS, not a native MSI.

### Build the installer

```bash
npm run package-win
```

Output: `release/LAQBreakTimer-Setup-<version>.exe`

On a Windows builder with WiX, you can also wrap that NSIS installer as an MSI:

```bash
npm run package-win-intune
```

### Win32 app (recommended)

Wrap the NSIS setup with the [Microsoft Win32 Content Prep Tool](https://learn.microsoft.com/en-us/intune/intune-service/apps/apps-win32-app-management).

**Per-machine (System context)** — typical shared PCs:

| Field     | Value                                                               |
| --------- | ------------------------------------------------------------------- |
| Install   | `LAQBreakTimer-Setup-2.1.0.exe /S /allusers`                        |
| Uninstall | `"C:\Program Files\LAQ BreakTimer\Uninstall LAQ BreakTimer.exe" /S` |
| Detection | File exists: `C:\Program Files\LAQ BreakTimer\LAQBreakTimer.exe`    |
| Context   | System                                                              |

**Per-user (User context)** — silent GitHub updates without UAC:

| Field     | Value                                                                      |
| --------- | -------------------------------------------------------------------------- |
| Install   | `LAQBreakTimer-Setup-2.1.0.exe /S /currentuser`                            |
| Uninstall | `"%LOCALAPPDATA%\Programs\LAQ BreakTimer\Uninstall LAQ BreakTimer.exe" /S` |
| Detection | File exists: `%LOCALAPPDATA%\Programs\LAQ BreakTimer\LAQBreakTimer.exe`    |
| Context   | User                                                                       |

Use **file exists**, not an exact file version. In-app GitHub updates change the version and would otherwise make Intune think the app is missing.

Per-machine updates from GitHub need elevation. If users cannot approve UAC, deploy per-user or push new versions with Intune instead of in-app update.

### MSI-wrapped LOB

`package-win-intune` produces `LAQBreakTimer-<version>.msi` that silently runs the NSIS installer with `/S /allusers`. Deploy as a Line-of-business MSI or as a Win32 app:

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
