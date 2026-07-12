// The welcome greeting is time based and always computed in Harare time, so a
// server anywhere greets the rider by their own clock. Three buckets match the
// three Shona greetings the dictionary carries: Mangwanani, Masikati, Manheru.
export type GreetingKey = "morning" | "afternoon" | "evening";

/** The hour of day (0 to 23) in Africa/Harare for the given instant. */
export function harareHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  // some engines render midnight as "24" under hour12:false; fold it to 0
  return Number(hour) % 24;
}

/** morning 05:00 to 11:59, afternoon 12:00 to 16:59, evening otherwise. */
export function greetingKey(now: Date): GreetingKey {
  const h = harareHour(now);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  return "evening";
}
