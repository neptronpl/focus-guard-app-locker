# Focus Guard - App Locker

> A GNOME Shell extension that blocks distracting applications so you can stay focused on your work.

![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%2B-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-GPL--2.0%2B-orange)

## What it does

Focus Guard lets you mark any application as **blocked**. Once blocked:

- Its windows are **immediately minimized** and cannot be brought to the foreground
- If you try to open or restore the app, it gets minimized again automatically
- The block persists across reboots until you explicitly remove it

## Features

- **Panel indicator** — shows how many apps are currently blocked; click to manage the list
- **Block current app** — one click to block whichever app is in focus
- **Per-app unblock** — unblock individual apps or clear all at once
- **Window right-click menu** — block/unblock directly from the window context menu
- **Persistent** — blocked apps are remembered across sessions via GSettings
- **Lightweight** — no background processes, pure GNOME Shell signals

## Installation

### From GNOME Extensions portal *(coming soon)*

Visit [extensions.gnome.org](https://extensions.gnome.org) and search for **Focus Guard - App Locker**.

### Manual installation

```bash
# Clone the repository
git clone https://github.com/neptronpl/focus-guard-app-locker.git

# Copy to GNOME extensions directory
cp -r focus-guard-app-locker \
  ~/.local/share/gnome-shell/extensions/focus-guard-app-locker@neptron.pl

# Compile the GSettings schema
glib-compile-schemas \
  ~/.local/share/gnome-shell/extensions/focus-guard-app-locker@neptron.pl/schemas/

# Log out and back in, then enable the extension
gnome-extensions enable focus-guard-app-locker@neptron.pl
```

## Usage

1. **Block an app** — focus the app you want to block, then click the shield icon in the top panel and choose *Block: [App Name]*
2. **Unblock an app** — click the panel icon and select the app from the blocked list, or right-click any window and choose *Unblock [App Name]*
3. **Unblock everything** — open the panel menu and click *Unblock all*

## Requirements

- GNOME Shell 45 or newer
- Wayland or X11

## Authors

- **Tomasz Nowak** — [tomasz.nowak@neptron.pl](mailto:tomasz.nowak@neptron.pl)
- **Claude AI** — Anthropic

## Credits

Inspired by and based on [Linux-Focus](https://github.com/kavindamihiran/Linux-Focus) by Kavinda Mihiran.

## License

GPL-2.0-or-later — see [GNU General Public License](https://www.gnu.org/licenses/gpl-2.0.html) for details.
