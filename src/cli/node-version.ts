/** Matches package.json's engines field, which npm only warns about on install. */
export const MIN_NODE_MAJOR = 24;

/** Null when this Node can run megareviewer, else what to tell the user. */
export const nodeVersionProblem = (version: string): string | null => {
  const major = Number.parseInt(version, 10);
  if (major >= MIN_NODE_MAJOR) return null;
  return `megareviewer needs Node ${MIN_NODE_MAJOR} or later, but this is Node ${version}. Install Node ${MIN_NODE_MAJOR} from https://nodejs.org and run it again.`;
};
