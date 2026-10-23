import { format } from "date-fns";

export function dailyReportTitle(isoDate: string): string {
  return `Sales for ${format(isoDate, "EEEE, MMMM do yyyy")}`;
}
