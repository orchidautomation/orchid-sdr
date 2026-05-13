export function isWeekdayInTimezone(date: Date, timeZone: string) {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone,
    }).format(date);

    return weekday !== "Sat" && weekday !== "Sun";
  } catch {
    const weekday = date.getUTCDay();
    return weekday >= 1 && weekday <= 5;
  }
}
