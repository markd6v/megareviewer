import { format, parseISO } from "date-fns";

export function dailyReportTitle(isoDate: string): string {
  return `Sales for ${format(parseISO(isoDate), "EEEE, MMMM do yyyy")}`;
}
