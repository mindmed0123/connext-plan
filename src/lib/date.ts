import { format, parseISO } from "date-fns";

export function getTodayDateInputValue() {
  return format(new Date(), "yyyy-MM-dd");
}

export function parseDateString(dateStr?: string | null): Date | null {
  if (!dateStr) return null;

  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let yearNum = parseInt(y, 10);
    if (yearNum < 100) yearNum += 2000;

    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;

    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
    return result;
  }

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCDate() !== day || result.getUTCMonth() !== month - 1) return null;
    return result;
  }

  const parsed = parseISO(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateBR(dateStr?: string | null, fallback = "—") {
  const parsed = parseDateString(dateStr);
  return parsed ? format(parsed, "dd/MM/yyyy") : fallback;
}
