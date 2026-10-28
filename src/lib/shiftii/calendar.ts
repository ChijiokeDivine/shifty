/** Framework-free calendar helpers. All date-only math happens in UTC. */
export function addCalendarDays(date: string, count: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid calendar date.");
  const d = new Date(date + "T12:00:00Z");
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid calendar date.");
  }
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}

export function startOfCalendarWeek(date: string, weekStartDay = 1): string {
  if (!Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
    throw new Error("Invalid week start day.");
  }
  const dow = new Date(date + "T12:00:00Z").getUTCDay();
  return addCalendarDays(date, -((dow - weekStartDay + 7) % 7));
}

export function calendarDateInZone(instant: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function timeOfDayInZone(iso: string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

/** Convert a company-local clock time to an ISO timestamp. Reject DST gaps.
 * If clocks repeat, choose the earlier occurrence consistently.
 */
export function localClockToIso(date: string, time: string, zone: string): string {
  addCalendarDays(date, 0);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid time.");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = new Set<number>();
  for (const probe of [wall - 86400000, wall, wall + 86400000]) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(probe));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const zoneAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    candidates.add(wall - (zoneAsUtc - probe));
  }
  const valid = [...candidates]
    .filter((candidate) => candidate >= 0 && candidate < 8640000000000000)
    .filter((candidate) => {
      const instant = new Date(candidate);
      return calendarDateInZone(instant, zone) === date &&
        timeOfDayInZone(instant.toISOString(), zone) === time;
    })
    .sort((a, b) => a - b);
  if (!valid.length) throw new Error("This local time does not exist due to a daylight saving clock change.");
  return new Date(valid[0]).toISOString();
}

export function shiftWindowFromClock(
  date: string, startTime: string, endTime: string, zone: string,
): { startAt: string; endAt: string } {
  const startAt = localClockToIso(date, startTime, zone);
  const endDate = endTime <= startTime ? addCalendarDays(date, 1) : date;
  const endAt = localClockToIso(endDate, endTime, zone);
  if (Date.parse(endAt) <= Date.parse(startAt)) throw new Error("Shift must end after its start.");
  if ((Date.parse(endAt) - Date.parse(startAt)) / 3600000 > 24) {
    throw new Error("Shifts cannot exceed 24 hours.");
  }
  return { startAt, endAt };
}

export function moveShiftWindow(
  startAt: string, endAt: string, newDate: string, zone: string,
): { startAt: string; endAt: string } {
  const startTime = timeOfDayInZone(startAt, zone);
  const endTime = timeOfDayInZone(endAt, zone);
  const originalStartDay = calendarDateInZone(new Date(startAt), zone);
  const originalEndDay = calendarDateInZone(new Date(endAt), zone);
  const daySpan = Math.round(
    (Date.parse(originalEndDay + "T12:00:00Z") - Date.parse(originalStartDay + "T12:00:00Z")) / 86400000,
  );
  if (daySpan < 0 || daySpan > 1) throw new Error("Only shifts within one overnight period can be moved.");
  const nextEndDate = addCalendarDays(newDate, daySpan);
  const nextStartAt = localClockToIso(newDate, startTime, zone);
  const nextEndAt = localClockToIso(nextEndDate, endTime, zone);
  if (Date.parse(nextEndAt) <= Date.parse(nextStartAt)) throw new Error("Invalid moved shift duration.");
  return { startAt: nextStartAt, endAt: nextEndAt };
}
