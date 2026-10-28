/**
 * Convert an absolute timestamp to minutes since midnight in an IANA timezone.
 * Availability rules are stored in organization-local wall-clock time.
 */
export function minutesOfDayInZone(timestamp: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Unable to resolve the shift time in organization timezone.");
  }
  return hour * 60 + minute;
}
