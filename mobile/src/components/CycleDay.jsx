// Jour du cycle d'une date : depuis le début des dernières règles notées avant elle.
export function cycleDayOf(day, periods = []) {
  const start = periods.map((p) => p.start).filter((s) => s <= day).sort().pop();
  if (!start) return null;
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;
}
