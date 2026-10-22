import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseJiraBaseUrl } from "../adapters/jira/index.ts";

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type GitHubTokenSource = "GITHUB_TOKEN" | "GH_TOKEN" | "gh auth token";

export interface GitHubConfig {
  readonly token: string;
  readonly source: GitHubTokenSource;
}

export interface BitbucketConfig {
  readonly email: string;
  readonly apiToken: string;
  /** Where the picker looks for PRs. null: the picker lists none, pasted URLs still work. */
  readonly workspace: string | null;
}

export interface JiraConfig {
  /** Checked with parseJiraBaseUrl. */
  readonly baseUrl: string;
  readonly email: string;
  readonly apiToken: string;
}

/** Anthropic credentials aren't here: the SDK resolves them itself. */
export interface Config {
  readonly github: GitHubConfig | null;
  readonly bitbucket: BitbucketConfig | null;
  readonly jira: JiraConfig | null;
  readonly home: string;
  readonly logLevel: LogLevel;
}

/**
 * A setting with a problem is left out of the config, so `doctor` can still check the rest.
 * The server only starts without problems.
 */
export interface ConfigResult {
  readonly config: Config;
  readonly problems: readonly string[];
}

export type Env = Readonly<Record<string, string | undefined>>;

/** Runs a program and returns its stdout, or null when it's missing, fails or times out. */
export type RunCommand = (file: string, args: readonly string[]) => Promise<string | null>;

const COMMAND_TIMEOUT_MS = 5000;

const runCommand: RunCommand = (file, args) =>
  new Promise((done) => {
    execFile(file, [...args], { timeout: COMMAND_TIMEOUT_MS, encoding: "utf8" }, (error, stdout) =>
      done(error === null ? stdout : null),
    );
  });

export const NO_GIT_HOST =
  "No git host is configured. For GitHub, set GITHUB_TOKEN or sign in with `gh auth login`. " +
  "For Bitbucket Cloud, set BITBUCKET_EMAIL and BITBUCKET_API_TOKEN (a scoped Atlassian API " +
  "token), plus BITBUCKET_WORKSPACE to list its PRs in the picker.";

/** The only module that reads the environment or runs other programs for configuration. */
export const loadConfig = async (
  options: { env?: Env; run?: RunCommand; homeDir?: string } = {},
): Promise<ConfigResult> => {
  const env = options.env ?? process.env;
  const run = options.run ?? runCommand;
  const problems: string[] = [];
  // A value of only whitespace counts as unset; tokens pasted with a newline still work.
  const read = (name: string): string | null => {
    const value = env[name]?.trim();
    return value === undefined || value === "" ? null : value;
  };

  /** All of the names set, or none: a partial set is a problem, and none is a missing service. */
  const readAll = <const N extends string>(
    service: string,
    names: readonly N[],
  ): Record<N, string> | null => {
    const values = names.map((name) => [name, read(name)] as const);
    const missing = values.filter(([, value]) => value === null).map(([name]) => name);
    if (missing.length === names.length) return null;
    if (missing.length > 0) {
      problems.push(`${service} is partly configured: also set ${missing.join(" and ")}.`);
      return null;
    }
    return Object.fromEntries(values) as Record<N, string>;
  };

  const github = await readGitHub(read, run);

  const bitbucketValues = readAll("Bitbucket", ["BITBUCKET_EMAIL", "BITBUCKET_API_TOKEN"]);
  const workspace = read("BITBUCKET_WORKSPACE");
  const noBitbucketCredentials =
    read("BITBUCKET_EMAIL") === null && read("BITBUCKET_API_TOKEN") === null;
  if (workspace !== null && noBitbucketCredentials) {
    // Likely set up for another tool with app passwords, which Atlassian replaced by API tokens.
    const appPassword =
      read("BITBUCKET_APP_PASSWORD") === null
        ? ""
        : " App passwords (BITBUCKET_APP_PASSWORD) aren't supported: create a scoped API token.";
    problems.push(
      `BITBUCKET_WORKSPACE is set without credentials: also set BITBUCKET_EMAIL and BITBUCKET_API_TOKEN.${appPassword}`,
    );
  }
  const bitbucket: BitbucketConfig | null =
    bitbucketValues === null
      ? null
      : {
          email: bitbucketValues.BITBUCKET_EMAIL,
          apiToken: bitbucketValues.BITBUCKET_API_TOKEN,
          workspace,
        };
  // A partial Bitbucket config already has its own problem.
  if (github === null && noBitbucketCredentials && workspace === null) problems.push(NO_GIT_HOST);

  const jiraValues = readAll("Jira", ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"]);
  let jira: JiraConfig | null = null;
  if (jiraValues !== null) {
    const baseUrl = parseJiraBaseUrl(jiraValues.JIRA_BASE_URL);
    if (baseUrl.ok) {
      jira = {
        baseUrl: baseUrl.value,
        email: jiraValues.JIRA_EMAIL,
        apiToken: jiraValues.JIRA_API_TOKEN,
      };
    } else {
      problems.push(baseUrl.error);
    }
  }

  const homeValue = read("MEGAREVIEWER_HOME");
  const home =
    homeValue === null ? join(options.homeDir ?? homedir(), ".megareviewer") : resolve(homeValue);

  const logValue = read("MEGAREVIEWER_LOG")?.toLowerCase() ?? "info";
  const logLevel = LOG_LEVELS.find((level) => level === logValue);
  if (logLevel === undefined) {
    problems.push(`MEGAREVIEWER_LOG must be one of ${LOG_LEVELS.join(", ")}.`);
  }

  return {
    config: { github, bitbucket, jira, home, logLevel: logLevel ?? "info" },
    problems,
  };
};

const readGitHub = async (
  read: (name: string) => string | null,
  run: RunCommand,
): Promise<GitHubConfig | null> => {
  for (const source of ["GITHUB_TOKEN", "GH_TOKEN"] as const) {
    const token = read(source);
    if (token !== null) return { token, source };
  }
  const token = (await run("gh", ["auth", "token"]))?.trim();
  return token === undefined || token === "" ? null : { token, source: "gh auth token" };
};
