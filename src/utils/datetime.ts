// Formateo de fechas en horario de Argentina, sin importar en qué
// zona horaria esté corriendo el proceso de Node (el sistema del
// usuario, un servidor Docker en otro huso horario, etc.). Usamos
// Intl con `timeZone` explícito en vez de confiar en la zona horaria
// local del sistema operativo.

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const LOCALE = "es-AR";

export function fmtDate(date: Date | string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function fmtTime(date: Date | string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function fmtDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
