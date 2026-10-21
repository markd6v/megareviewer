// Repository paths are always "/"-separated, whatever the OS.

export const basename = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** "" for a file at the repository root. */
export const dirname = (path: string): string => path.slice(0, Math.max(path.lastIndexOf("/"), 0));

/** Lowercased, with the dot: ".ts". "" when there is none; a leading dot doesn't count. */
export const extension = (path: string): string => {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
};
