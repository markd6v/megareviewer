import { Dialog } from "./Dialog.tsx";
import { SHORTCUTS } from "./shortcuts.ts";

const KEY_NAMES: Readonly<Record<string, string>> = { Escape: "Esc" };

export const ShortcutsDialog = ({ onClose }: { readonly onClose: () => void }) => (
  <Dialog title="Keyboard shortcuts" onClose={onClose} className="shortcuts-dialog">
    <dl className="shortcut-list">
      {SHORTCUTS.map(({ keys, description }) => (
        <div key={description}>
          <dt>
            {keys.map((key) => (
              <kbd key={key}>{KEY_NAMES[key] ?? key}</kbd>
            ))}
          </dt>
          <dd>{description}</dd>
        </div>
      ))}
    </dl>
    <p className="muted">Shortcuts don't work while you're typing in a text field.</p>
  </Dialog>
);
