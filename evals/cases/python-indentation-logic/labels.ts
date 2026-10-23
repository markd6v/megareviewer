import type { CaseLabels } from "../../labels.ts";

export const labels: CaseLabels = {
  risk: {
    // Dedenting `count += …` out of the `if` changes what's counted. A mechanical proof here
    // would hide a logic change, so it must come out logic.
    h_0ea106903cb8153b: "logic",
  },
  decisions: [
    {
      description:
        "The item count now includes inactive items while the total still excludes them, so count and total describe different sets of items",
      mustHave: true,
    },
  ],
  mismatches: [],
};
