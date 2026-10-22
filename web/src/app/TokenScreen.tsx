/** Shown instead of the app when there's no usable session token. Calls no API. */
export const TokenScreen = ({ reason }: { readonly reason: "missing" | "ended" }) => (
  <main className="page narrow">
    <h1>Open megareviewer from your terminal</h1>
    {reason === "missing" ? (
      <p>
        This page needs the link megareviewer printed when it started. It looks like{" "}
        <code>http://127.0.0.1:4823/?token=…</code>. Copy it from your terminal and open it.
      </p>
    ) : (
      <p>
        This page's session has ended, usually because megareviewer was restarted. Open the new link
        printed in your terminal.
      </p>
    )}
    <p className="muted">
      Not running? Start it with <code>npx megareviewer</code>.
    </p>
  </main>
);
