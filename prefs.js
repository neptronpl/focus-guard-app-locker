/* Focus Guard - App Locker — Preferences
 *
 * Authors:
 *   Tomasz Nowak <tomasz.nowak@neptron.pl>
 *   Claude AI (Anthropic)
 *
 * License: GPL-2.0+
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class FocusGuardPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const _ = this.gettext.bind(this);
        const settings = this.getSettings('org.gnome.shell.extensions.focus-guard');

        const page = new Adw.PreferencesPage({
            title: _('Settings'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Keyboard shortcuts'),
            description: _('Set a keyboard shortcut for toggling blocking.'),
        });
        page.add(group);

        group.add(this._buildShortcutRow(settings, window, _));
    }

    _buildShortcutRow(settings, prefWindow, _) {
        const row = new Adw.ActionRow({
            title: _('Toggle blocking'),
            subtitle: _('Enables or disables blocking for all apps in the list'),
        });

        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: _('Not set'),
            valign: Gtk.Align.CENTER,
        });

        const updateLabel = () => {
            const shortcuts = settings.get_strv('toggle-shortcut');
            shortcutLabel.set_accelerator(shortcuts.length > 0 ? shortcuts[0] : '');
        };
        updateLabel();

        const clearBtn = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: _('Clear shortcut'),
        });
        clearBtn.connect('clicked', () => {
            settings.set_strv('toggle-shortcut', []);
            updateLabel();
        });

        const setBtn = new Gtk.Button({
            label: _('Set shortcut'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });

        row.add_suffix(shortcutLabel);
        row.add_suffix(clearBtn);
        row.add_suffix(setBtn);

        let isRecording = false;
        let keyController = null;

        const stopRecording = () => {
            if (!isRecording) return;
            isRecording = false;
            if (keyController) {
                prefWindow.remove_controller(keyController);
                keyController = null;
            }
            setBtn.label = _('Set shortcut');
            setBtn.css_classes = ['suggested-action'];
            setBtn.sensitive = true;
        };

        setBtn.connect('clicked', () => {
            if (isRecording) return;
            isRecording = true;
            setBtn.label = _('Press shortcut…');
            setBtn.css_classes = ['destructive-action'];
            setBtn.sensitive = false;

            keyController = new Gtk.EventControllerKey();
            prefWindow.add_controller(keyController);
            prefWindow.grab_focus();

            keyController.connect('key-pressed', (_ctrl, keyval, _keycode, state) => {
                if (keyval === Gdk.KEY_Escape) {
                    stopRecording();
                    return Gdk.EVENT_STOP;
                }

                const modifierKeys = [
                    Gdk.KEY_Control_L, Gdk.KEY_Control_R,
                    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
                    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
                    Gdk.KEY_Super_L, Gdk.KEY_Super_R,
                    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
                    Gdk.KEY_Hyper_L, Gdk.KEY_Hyper_R,
                    Gdk.KEY_ISO_Level3_Shift,
                ];
                if (modifierKeys.includes(keyval))
                    return Gdk.EVENT_PROPAGATE;

                const mods = state & Gtk.accelerator_get_default_mod_mask();
                const accel = Gtk.accelerator_name(keyval, mods);
                if (accel && accel !== '') {
                    settings.set_strv('toggle-shortcut', [accel]);
                    updateLabel();
                }

                stopRecording();
                return Gdk.EVENT_STOP;
            });
        });

        return row;
    }
}
