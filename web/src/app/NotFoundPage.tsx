import { Link } from "./Link.tsx";

export const NotFoundPage = () => (
  <div className="narrow">
    <h1>Page not found</h1>
    <p>
      There's nothing at this address. <Link to="/">Go to your pull requests</Link>.
    </p>
  </div>
);
