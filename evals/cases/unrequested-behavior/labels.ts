import type { CaseLabels } from "../../labels.ts";

export const labels: CaseLabels = {
  risk: {
    h_8ef6c88894532fc5: "contract", // session lifetime, cookie and analytics call
    h_c436db7f164080f1: "logic", // checkbox
  },
  decisions: [
    {
      description: "Sends each user's email and IP address to the analytics service on every login",
      mustHave: true,
    },
    {
      description: "Remembered sessions and their cookies last 30 days",
      mustHave: false,
    },
  ],
  mismatches: [
    {
      kind: "unrequested",
      description:
        "Tracks logins in analytics with the user's email and IP, which the ticket doesn't ask for",
    },
  ],
};
