const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatLeadDate(d: Date): string {
  return formatter.format(d);
}
