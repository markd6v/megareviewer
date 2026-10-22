import type { StatusResponse } from "../../../../contracts/index.ts";
import { setupItems } from "./setup.ts";

export const SetupStatus = ({ status }: { readonly status: StatusResponse }) => (
  <section className="setup" aria-label="Setup">
    <dl className="setup-items">
      {setupItems(status).map((item) => (
        <div key={item.name} className={`setup-item state-${item.state}`}>
          <dt>{item.name}</dt>
          <dd>{item.text}</dd>
        </div>
      ))}
    </dl>
  </section>
);
