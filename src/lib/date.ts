import { format, parseISO } from "date-fns";

export function getTodayDateInputValue() {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Data de hoje no fuso de São Paulo, como 'YYYY-MM-DD'.
 * Usada para decidir o que está vencido, igual ao banco de dados.
 */
export function getTodayKeySaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Um vencimento só está vencido quando é ANTERIOR a hoje (São Paulo). */
export function isVencido(dateStr?: string | null) {
  if (!dateStr) return false;
  return String(dateStr).slice(0, 10) < getTodayKeySaoPaulo();
}

/** Converte um Date local em chave 'YYYY-MM-DD' (sem conversão para UTC). */
export function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/**
 * Parse a date string into a LOCAL Date object at local midnight.
 * Critical: we use local midnight (not UTC) so that date-fns `format()`
 * (which uses local timezone) renders the same calendar day the user picked.
 */
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
    const result = new Date(yearNum, monthNum - 1, dayNum, 12, 0, 0, 0);
    if (result.getDate() !== dayNum || result.getMonth() !== monthNum - 1) return null;
    return result;
  }

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    // Use noon local to avoid any DST edge cases shifting the calendar day.
    const result = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (result.getDate() !== day || result.getMonth() !== month - 1) return null;
    return result;
  }

  const parsed = parseISO(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateBR(dateStr?: string | null, fallback = "—") {
  const parsed = parseDateString(dateStr);
  return parsed ? format(parsed, "dd/MM/yyyy") : fallback;
}
