import { useId } from "react";
import type { RiskAssessment } from "../../../src/domain/review/index.ts";

/** The hunk's risk class; its reason shows on hover and on focus, and describes the badge. */
export const RiskBadge = ({ risk }: { readonly risk: RiskAssessment }) => {
  const id = useId();
  return (
    <span className="risk">
      <button type="button" className={`risk-badge risk-${risk.riskClass}`} aria-describedby={id}>
        {risk.riskClass}
      </button>
      <span role="tooltip" id={id} className="risk-reason">
        {risk.reason}
      </span>
    </span>
  );
};
