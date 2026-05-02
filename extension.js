/* Focus Guard - App Locker — GNOME Shell Extension
 *
 * Block distracting applications to maintain concentration.
 * Blocked apps have their windows automatically minimized whenever
 * they appear, until explicitly unblocked by the user.
 *
 * Authors:
 *   Tomasz Nowak <tomasz.nowak@neptron.pl>
 *   Claude AI (Anthropic)
 *
 * Contact: tomasz.nowak@neptron.pl
 *
 * Based on Linux-Focus by Kavinda Mihiran
 * https://github.com/kavindamihiran/Linux-Focus
 *
 * License: GPL-2.0+
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// ─── Panel Indicator ────────────────────────────────────────────────────────

const FocusGuardIndicator = GObject.registerClass(
class FocusGuardIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'Focus Guard');
        this._ext = ext;
        this._destroyed = false;

        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});

        this._icon = new St.Icon({
            icon_name: 'security-high-symbolic',
            style_class: 'system-status-icon focus-guard-icon',
        });
        this._countLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'focus-guard-count',
        });

        box.add_child(this._icon);
        box.add_child(this._countLabel);
        this.add_child(box);

        this._buildMenu();

        this._openStateId = this.menu.connect('open-state-changed', (_menu, open) => {
            if (open) this.refresh();
        });
    }

    _buildMenu() {
        this.menu.removeAll();

        // Header (non-interactive)
        const header = new PopupMenu.PopupMenuItem('Focus Guard', {reactive: false});
        header.label.style_class = 'focus-guard-header';
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Block current focused app
        this._blockCurrentItem = new PopupMenu.PopupMenuItem('Zablokuj bieżącą aplikację');
        this._blockCurrentItem.connect('activate', () => this._ext.blockCurrentApp());
        this.menu.addMenuItem(this._blockCurrentItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Dynamically populated list of blocked apps
        this._blockedSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._blockedSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Unblock all
        this._unblockAllItem = new PopupMenu.PopupMenuItem('Odblokuj wszystkie');
        this._unblockAllItem.connect('activate', () => this._ext.unblockAllApps());
        this.menu.addMenuItem(this._unblockAllItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Preferences
        const prefsItem = new PopupMenu.PopupMenuItem('Preferencje');
        prefsItem.connect('activate', () => this._ext.openPreferences());
        this.menu.addMenuItem(prefsItem);
    }

    _refreshMenu() {
        if (this._destroyed) return;

        this._blockedSection.removeAll();

        const blocked = this._ext.getBlockedApps();

        if (blocked.size === 0) {
            const empty = new PopupMenu.PopupMenuItem('Brak zablokowanych aplikacji', {reactive: false});
            empty.label.style = 'font-style: italic; color: alpha(currentColor, 0.5);';
            this._blockedSection.addMenuItem(empty);
            try { this._unblockAllItem.setSensitive(false); } catch (_e) {}
        } else {
            try { this._unblockAllItem.setSensitive(true); } catch (_e) {}
            for (const [appId, appName] of blocked) {
                const item = new PopupMenu.PopupMenuItem(`\u{1F6AB} ${appName}`);
                item.connect('activate', () => this._ext.unblockApp(appId));
                this._blockedSection.addMenuItem(item);
            }
        }

        // Restore item — dynamically added when snapshot exists
        const last = this._ext.getLastBlockedApps();
        if (last.size > 0) {
            this._blockedSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const names = [...last.values()].join(', ');
            const restoreItem = new PopupMenu.PopupMenuItem(
                `↩ Przywróć ostatnio blokowane (${last.size}): ${names}`
            );
            restoreItem.connect('activate', () => this._ext.restoreLastBlockedApps());
            this._blockedSection.addMenuItem(restoreItem);
        }

        this._updateBlockCurrentItem();
    }

    _updateBlockCurrentItem() {
        if (this._destroyed) return;
        const win = global.display.get_focus_window();
        if (win) {
            const tracker = Shell.WindowTracker.get_default();
            const app = tracker.get_window_app(win);
            if (app && app.get_id() && !_isSystemApp(app)) {
                const appId = app.get_id();
                const appName = app.get_name();
                if (this._ext.isBlocked(appId)) {
                    this._blockCurrentItem.label.text = `✓ ${appName} (już zablokowana)`;
                    this._blockCurrentItem.setSensitive(false);
                } else {
                    this._blockCurrentItem.label.text = `Zablokuj: ${appName}`;
                    this._blockCurrentItem.setSensitive(true);
                }
                return;
            }
        }
        this._blockCurrentItem.label.text = 'Zablokuj bieżącą aplikację';
        this._blockCurrentItem.setSensitive(false);
    }

    _updateIcon() {
        if (this._destroyed) return;
        const count = this._ext.getBlockedApps().size;
        if (count > 0) {
            this._icon.icon_name = 'security-low-symbolic';
            this._icon.style_class = 'system-status-icon focus-guard-icon active';
            this._countLabel.text = `${count}`;
        } else {
            this._icon.icon_name = 'security-high-symbolic';
            this._icon.style_class = 'system-status-icon focus-guard-icon';
            this._countLabel.text = '';
        }
    }

    refresh() {
        if (this._destroyed) return;
        this._refreshMenu();
        this._updateIcon();
    }

    destroy() {
        this._destroyed = true;
        if (this._openStateId) {
            this.menu.disconnect(this._openStateId);
            this._openStateId = null;
        }
        super.destroy();
    }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function _isSystemApp(app) {
    const id = app.get_id() || '';
    return id === '' || id === 'gnome-shell';
}

function _getAppFromWindow(window) {
    if (!window) return null;
    const tracker = Shell.WindowTracker.get_default();
    const app = tracker.get_window_app(window);
    if (!app || !app.get_id() || _isSystemApp(app)) return null;
    return app;
}

// ─── Extension ──────────────────────────────────────────────────────────────

export default class FocusGuardExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._settings = null;
        this._blockedApps = new Map();      // appId → appName
        this._lastBlockedApps = new Map();  // snapshot saved on "unblock all"
        this._enabled = false;
        this._windowCreatedId = null;
    }

    enable() {
        this._enabled = true;
        this._settings = this.getSettings('org.gnome.shell.extensions.focus-guard');
        this._loadBlockedApps();
        this._loadLastBlockedApps();

        this._indicator = new FocusGuardIndicator(this);
        Main.panel.addToStatusArea('focus-guard', this._indicator);
        this._indicator.refresh();

        Main.wm.addKeybinding(
            'toggle-shortcut',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => this.quickToggle()
        );

        // New window created (app launched)
        this._windowCreatedId = global.display.connect('window-created', (_d, window) => {
            this._onWindowCreated(window);
        });

        // Window mapped/restored from minimized state (e.g. clicked in taskbar)
        this._mapId = global.window_manager.connect('map', (_wm, actor) => {
            this._onWindowMapped(actor.meta_window);
        });

        // Focus changed — last line of defence if the window slips through
        this._focusId = global.display.connect('notify::focus-window', () => {
            this._onFocusChanged();
        });

        // Minimize already-open windows of blocked apps on startup
        this._minimizeAllBlockedWindows();

    }

    disable() {
        this._enabled = false;
        Main.wm.removeKeybinding('toggle-shortcut');

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }
        if (this._mapId) {
            global.window_manager.disconnect(this._mapId);
            this._mapId = null;
        }
        if (this._focusId) {
            global.display.disconnect(this._focusId);
            this._focusId = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
        this._blockedApps.clear();
        this._lastBlockedApps.clear();
    }

    // ── Public API ────────────────────────────────────────────────────────

    getBlockedApps() {
        return this._blockedApps;
    }

    getLastBlockedApps() {
        return this._lastBlockedApps;
    }

    isBlocked(appId) {
        return this._blockedApps.has(appId);
    }

    quickToggle() {
        if (this._blockedApps.size > 0) {
            this.unblockAllApps();
        } else if (this._lastBlockedApps.size > 0) {
            this.restoreLastBlockedApps();
        } else {
            Main.notify('Focus Guard', 'Brak zablokowanych aplikacji.');
        }
    }

    blockCurrentApp() {
        const win = global.display.get_focus_window();
        if (!win) {
            Main.notify('Focus Guard', 'Brak aktywnego okna.');
            return;
        }
        const app = _getAppFromWindow(win);
        if (!app) {
            Main.notify('Focus Guard', 'Nie można zidentyfikować aplikacji.');
            return;
        }
        this.blockApp(app.get_id(), app.get_name());
    }

    blockApp(appId, appName) {
        if (!appId || this._blockedApps.has(appId)) return;
        this._blockedApps.set(appId, appName || appId);
        this._saveBlockedApps();
        this._minimizeAppWindows(appId);
        this._indicator?.refresh();
        Main.notify('Focus Guard', `Zablokowano: ${appName || appId}`);
    }

    unblockApp(appId) {
        if (!this._blockedApps.has(appId)) return;
        const appName = this._blockedApps.get(appId);
        this._blockedApps.delete(appId);
        this._saveBlockedApps();
        this._indicator?.refresh();
        Main.notify('Focus Guard', `Odblokowano: ${appName}`);
    }

    unblockAllApps() {
        if (this._blockedApps.size > 0) {
            this._lastBlockedApps = new Map(this._blockedApps);
            this._saveLastBlockedApps();
        }
        this._blockedApps.clear();
        this._saveBlockedApps();
        this._indicator?.refresh();
        Main.notify('Focus Guard', 'Wszystkie aplikacje odblokowane.');
    }

    restoreLastBlockedApps() {
        if (this._lastBlockedApps.size === 0) return;
        const count = this._lastBlockedApps.size;
        for (const [appId, appName] of this._lastBlockedApps)
            this._blockedApps.set(appId, appName);
        this._saveBlockedApps();
        this._lastBlockedApps.clear();
        this._saveLastBlockedApps();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (!this._enabled) return GLib.SOURCE_REMOVE;
            this._minimizeAllBlockedWindows();
            return GLib.SOURCE_REMOVE;
        });
        this._indicator?.refresh();
        Main.notify('Focus Guard', `Przywrócono blokowanie (${count} aplikacji).`);
    }

    // ── Window monitoring ─────────────────────────────────────────────────

    _onWindowCreated(window) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            if (!this._enabled) return GLib.SOURCE_REMOVE;
            try {
                if (!window.get_compositor_private()) return GLib.SOURCE_REMOVE;
                this._blockWindowIfNeeded(window);
            } catch (_e) { /* window may have been closed */ }
            return GLib.SOURCE_REMOVE;
        });
    }

    _onWindowMapped(window) {
        if (!window) return;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            if (!this._enabled) return GLib.SOURCE_REMOVE;
            try {
                this._blockWindowIfNeeded(window);
            } catch (_e) { /* ignore */ }
            return GLib.SOURCE_REMOVE;
        });
    }

    _onFocusChanged() {
        const window = global.display.get_focus_window();
        if (!window) return;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            if (!this._enabled) return GLib.SOURCE_REMOVE;
            try {
                this._blockWindowIfNeeded(window);
            } catch (_e) { /* ignore */ }
            return GLib.SOURCE_REMOVE;
        });
    }

    _blockWindowIfNeeded(window) {
        const app = _getAppFromWindow(window);
        if (!app || !this.isBlocked(app.get_id())) return;
        if (!window.minimized && window.can_minimize())
            window.minimize();
    }

    _minimizeAppWindows(appId) {
        const tracker = Shell.WindowTracker.get_default();
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (const win of windows) {
            const app = tracker.get_window_app(win);
            if (app && app.get_id() === appId && !win.minimized) {
                win.minimize();
            }
        }
    }

    _minimizeAllBlockedWindows() {
        const tracker = Shell.WindowTracker.get_default();
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (const win of windows) {
            const app = tracker.get_window_app(win);
            if (app && this.isBlocked(app.get_id()) && !win.minimized) {
                win.minimize();
            }
        }
    }

    // ── Persistence ───────────────────────────────────────────────────────

    _loadBlockedApps() {
        this._blockedApps.clear();
        const stored = this._settings.get_strv('blocked-apps');
        for (const entry of stored) {
            const sep = entry.indexOf('|');
            if (sep !== -1) {
                this._blockedApps.set(
                    entry.substring(0, sep),
                    entry.substring(sep + 1)
                );
            }
        }
    }

    _saveBlockedApps() {
        const entries = [];
        for (const [appId, appName] of this._blockedApps)
            entries.push(`${appId}|${appName}`);
        this._settings.set_strv('blocked-apps', entries);
    }

    _loadLastBlockedApps() {
        this._lastBlockedApps.clear();
        for (const entry of this._settings.get_strv('last-blocked-apps')) {
            const sep = entry.indexOf('|');
            if (sep !== -1)
                this._lastBlockedApps.set(entry.substring(0, sep), entry.substring(sep + 1));
        }
    }

    _saveLastBlockedApps() {
        const entries = [];
        for (const [appId, appName] of this._lastBlockedApps)
            entries.push(`${appId}|${appName}`);
        this._settings.set_strv('last-blocked-apps', entries);
    }

}
