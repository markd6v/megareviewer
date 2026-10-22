import { type FormEvent, type Ref, useId, useState } from "react";
import { parsePullRequestUrl } from "../../../../src/domain/review/index.ts";
import { type ApiError, errorMessage } from "../../api/index.ts";

const UNSUPPORTED = errorMessage({ code: "unsupported-url", message: "" });

export const UrlForm = ({
  inputRef,
  pending,
  error,
  onSubmit,
}: {
  readonly inputRef: Ref<HTMLInputElement>;
  readonly pending: boolean;
  /** The last failed submit. */
  readonly error: ApiError | null;
  readonly onSubmit: (url: string) => void;
}) => {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const id = useId();
  const empty = url.trim() === "";
  const valid = !empty && parsePullRequestUrl(url).ok;
  // A failed submit's error stays until the URL is edited.
  const submitError = error !== null && submitted === url ? errorMessage(error) : null;
  const problem = empty || valid ? submitError : UNSUPPORTED;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || pending) return;
    setSubmitted(url);
    onSubmit(url.trim());
  };

  return (
    <form className="url-form" onSubmit={submit} noValidate>
      <label htmlFor={`${id}-url`}>Pull request URL</label>
      <div className="url-form-row">
        <input
          ref={inputRef}
          id={`${id}-url`}
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://github.com/owner/repo/pull/123"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={!empty && !valid}
          aria-describedby={`${id}-hint`}
        />
        <button type="submit" className="button primary" disabled={!valid || pending}>
          {pending ? "Starting…" : "Analyze"}
        </button>
      </div>
      <p id={`${id}-hint`} className={problem === null ? "hint" : "hint field-error"} role="status">
        {problem ?? (
          <>
            Paste a GitHub or Bitbucket Cloud pull request link. Press <kbd>/</kbd> to focus.
          </>
        )}
      </p>
    </form>
  );
};
