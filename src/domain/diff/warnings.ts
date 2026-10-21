import { LOCKFILE_MANIFESTS } from "./lockfiles.ts";
import { basename, dirname } from "./path.ts";
import type { FileChange } from "./types.ts";

/**
 * Lockfiles that changed with no change to a matching manifest in the same directory or below.
 * The lockfile stays collapsed as generated, so the warning is how the reviewer learns that its
 * dependencies changed for no visible reason.
 */
export const lockfileWarnings = (files: readonly FileChange[]): string[] => {
  const changed = files.flatMap((file) => (file.oldPath ? [file.path, file.oldPath] : [file.path]));
  return files.flatMap((file) => {
    const manifests = LOCKFILE_MANIFESTS.get(basename(file.path));
    if (manifests === undefined) return [];
    const dir = dirname(file.path);
    const inScope = changed.filter((path) => dir === "" || path.startsWith(`${dir}/`));
    const hasManifest = inScope.some((path) =>
      manifests.some((manifest) =>
        manifest.startsWith("*")
          ? basename(path).endsWith(manifest.slice(1))
          : basename(path) === manifest,
      ),
    );
    if (hasManifest) return [];
    const names = manifests.map((manifest) => (dir === "" ? manifest : `${dir}/${manifest}`));
    return [`${file.path} changed without a change to ${orList(names)}`];
  });
};

const orList = (items: readonly string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
