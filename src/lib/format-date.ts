const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLeadDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return formatter.format(d);
}

export const formatDate = formatLeadDate;
