/** The first Node with node:sqlite unflagged. Matches package.json's engines, which npm only warns about. */
export const MIN_NODE = { major: 22, minor: 13 } as const;

const MIN_NODE_TEXT = `${MIN_NODE.major}.${MIN_NODE.minor}`;

export const NODE_FIX = `Install Node ${MIN_NODE_TEXT} or later, e.g. the current LTS from https://nodejs.org.`;

export const nodeSupported = (version: string): boolean => {
  const [major = Number.NaN, minor = Number.NaN] = version.split(".").map(Number);
  return major > MIN_NODE.major || (major === MIN_NODE.major && minor >= MIN_NODE.minor);
};

/** Null when this Node can run megareviewer, else what to tell the user. */
export const nodeVersionProblem = (version: string): string | null =>
  nodeSupported(version)
    ? null
    : `megareviewer needs Node ${MIN_NODE_TEXT} or later, but this is Node ${version}. ${NODE_FIX}`;
