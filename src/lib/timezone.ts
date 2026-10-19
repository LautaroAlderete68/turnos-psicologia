import { format, parse, addMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

/**
 * Obtiene la fecha y hora actual interpretada en la zona horaria de Argentina.
 */
export function nowInArgentina(): Date {
  return toZonedTime(new Date(), ARGENTINA_TIMEZONE);
}

/**
 * Convierte un timestamp UTC a fecha local de Argentina.
 */
export function toArgentinaZoned(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(d, ARGENTINA_TIMEZONE);
}

/**
 * Convierte una fecha y hora local de Argentina a UTC Date.
 * @param dateStr e.g. "2026-10-25"
 * @param timeStr e.g. "15:30"
 */
export function argentinaTimeToUtc(dateStr: string, timeStr: string): Date {
  // Construye "2026-10-25 15:30"
  const localDateTimeStr = `${dateStr} ${timeStr}:00`;
  const parsed = parse(localDateTimeStr, "yyyy-MM-dd HH:mm:ss", new Date());
  return fromZonedTime(parsed, ARGENTINA_TIMEZONE);
}

/**
 * Formatea una fecha a DD/MM/AAAA en horario de Argentina.
 */
export function formatDateDDMMAAAA(date: Date | string): string {
  const zoned = toArgentinaZoned(date);
  return format(zoned, "dd/MM/yyyy");
}

/**
 * Formatea un horario en formato 24 horas "HH:mm" en horario de Argentina.
 */
export function formatTime24h(date: Date | string): string {
  const zoned = toArgentinaZoned(date);
  return format(zoned, "HH:mm");
}

/**
 * Formatea fecha y hora completa "DD/MM/AAAA HH:mm" en horario de Argentina.
 */
export function formatDateTimeArgentina(date: Date | string): string {
  const zoned = toArgentinaZoned(date);
  return format(zoned, "dd/MM/yyyy HH:mm");
}

/**
 * Formatea con nombre de día y mes en español rioplatense.
 * Ej: "Lunes 19 de octubre de 2026"
 */
export function formatFullDateLong(date: Date | string): string {
  const zoned = toArgentinaZoned(date);
  const formatted = format(zoned, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Devuelve la cadena "YYYY-MM-DD" según el día en Argentina.
 */
export function getArgentinaDateString(date: Date | string): string {
  const zoned = toArgentinaZoned(date);
  return format(zoned, "yyyy-MM-dd");
}

/**
 * Devuelve el día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado) en Argentina.
 */
export function getArgentinaDayOfWeek(date: Date | string): number {
  const zoned = toArgentinaZoned(date);
  return zoned.getDay();
}

/**
 * Compara si una fecha en UTC ya pasó respecto al momento actual.
 */
export function isPastUtc(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getTime() < Date.now();
}
