/** The CLI opens the UI with the session token in this query parameter. */
const URL_PARAM = "token";
const STORAGE_KEY = "megareviewer.token";

export interface SessionToken {
  /** null when the page wasn't opened from the CLI's link. */
  readonly value: string | null;
  /** Forgets a token the server rejected. */
  clear(): void;
}

/** The parts of `window` this needs. */
interface TokenWindow {
  readonly location: { readonly href: string };
  readonly history: {
    readonly state: unknown;
    replaceState(data: unknown, unused: string, url: string): void;
  };
  readonly sessionStorage: Storage;
}

/**
 * Takes the token from the URL, keeps it in sessionStorage for reloads in this tab, and removes
 * it from the address bar so it doesn't end up in history or screenshots. Storage can be
 * unavailable (or throw on access), in which case the token lives only in memory.
 */
export const bootstrapSessionToken = (win: TokenWindow): SessionToken => {
  const storage = (() => {
    try {
      return win.sessionStorage;
    } catch {
      return null;
    }
  })();
  const attempt = <T>(action: (storage: Storage) => T): T | null => {
    try {
      return storage === null ? null : action(storage);
    } catch {
      return null;
    }
  };

  const url = new URL(win.location.href);
  const fromUrl = url.searchParams.get(URL_PARAM);
  let value: string | null;
  if (fromUrl !== null && fromUrl !== "") {
    value = fromUrl;
    attempt((s) => s.setItem(STORAGE_KEY, fromUrl));
  } else {
    value = attempt((s) => s.getItem(STORAGE_KEY));
  }
  if (url.searchParams.has(URL_PARAM)) {
    url.searchParams.delete(URL_PARAM);
    win.history.replaceState(win.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return {
    get value() {
      return value;
    },
    clear() {
      value = null;
      attempt((s) => s.removeItem(STORAGE_KEY));
    },
  };
};
