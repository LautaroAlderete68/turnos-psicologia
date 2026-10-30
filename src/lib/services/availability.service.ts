import { addMinutes, addHours, isAfter, isBefore, parse } from "date-fns";
import prisma from "../prisma";
import { AppointmentService } from "./appointment.service";
import {
  argentinaTimeToUtc,
  getArgentinaDayOfWeek,
  getArgentinaDateString,
  toArgentinaZoned,
  formatTime24h,
} from "../timezone";

export interface TimeSlot {
  time: string; // "14:00"
  startTimeUtc: Date;
  endTimeUtc: Date;
  available: boolean;
  reason?: string;
}

export interface DayAvailability {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: number;
  isOpen: boolean;
  closedReason?: string;
  slots: TimeSlot[];
}

/**
 * Convierte un string "HH:mm" a minutos desde las 00:00 para comparaciones simples.
 */
function timeToMinutes(timeStr: string): number {
  const [hours, mins] = timeStr.split(":").map(Number);
  return hours * 60 + mins;
}

/**
 * Convierte minutos desde las 00:00 a string "HH:mm".
 */
function minutesToTime(totalMins: number): string {
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export class AvailabilityService {
  /**
   * Obtiene la disponibilidad para una fecha específica ("YYYY-MM-DD" en Argentina).
   */
  static async getSlotsForDate(dateStr: string): Promise<DayAvailability> {
    try {
      await AppointmentService.cleanExpiredAppointments();
    } catch {}
    const profile = await prisma.psychologistProfile.findFirst();
    if (!profile) {
      throw new Error("Perfil profesional no configurado");
    }

    const now = new Date();
    const todayStr = getArgentinaDateString(now);

    // No permitir reservas en fechas pasadas
    if (dateStr < todayStr) {
      return {
        date: dateStr,
        dayOfWeek: getArgentinaDayOfWeek(dateStr),
        isOpen: false,
        closedReason: "Fecha pasada",
        slots: [],
      };
    }

    // Verificar límite máximo de días hacia adelante
    const maxFutureDate = getArgentinaDateString(addHours(now, profile.maxAdvanceDays * 24));
    if (dateStr > maxFutureDate) {
      return {
        date: dateStr,
        dayOfWeek: getArgentinaDayOfWeek(dateStr),
        isOpen: false,
        closedReason: `Solo se admiten reservas con hasta ${profile.maxAdvanceDays} días de anticipación`,
        slots: [],
      };
    }

    // 1. Verificar si hay excepción para esta fecha (Feriados, vacaciones o horarios especiales)
    const exception = await prisma.scheduleException.findUnique({
      where: { dateString: dateStr },
    });

    let startTimeStr = "09:00";
    let endTimeStr = "18:00";
    let breakStartStr: string | null = null;
    let breakEndStr: string | null = null;

    if (exception) {
      if (!exception.isAvailable) {
        return {
          date: dateStr,
          dayOfWeek: getArgentinaDayOfWeek(dateStr),
          isOpen: false,
          closedReason: exception.reason || "Día no laborable / Excepción",
          slots: [],
        };
      }
      if (exception.startTime && exception.endTime) {
        startTimeStr = exception.startTime;
        endTimeStr = exception.endTime;
      }
    } else {
      // 2. Horario semanal habitual
      // Calculamos el día de la semana para la fecha dada
      const sampleUtc = argentinaTimeToUtc(dateStr, "12:00");
      const dayOfWeek = getArgentinaDayOfWeek(sampleUtc);

      const weekly = await prisma.weeklySchedule.findUnique({
        where: { dayOfWeek },
      });

      if (!weekly || !weekly.isActive) {
        return {
          date: dateStr,
          dayOfWeek,
          isOpen: false,
          closedReason: "Sin atención habitual este día",
          slots: [],
        };
      }

      startTimeStr = weekly.startTime;
      endTimeStr = weekly.endTime;
      breakStartStr = weekly.breakStartTime;
      breakEndStr = weekly.breakEndTime;
    }

    // 3. Generar franjas candidatas
    const startMins = timeToMinutes(startTimeStr);
    const endMins = timeToMinutes(endTimeStr);
    const slotDuration = profile.sessionDuration;
    const buffer = profile.bufferMinutes;
    const step = slotDuration + buffer;

    const candidateSlots: { time: string; startUtc: Date; endUtc: Date }[] = [];

    for (let current = startMins; current + slotDuration <= endMins; current += step) {
      const timeStr = minutesToTime(current);

      // Descartar si cae dentro de la pausa / almuerzo
      if (breakStartStr && breakEndStr) {
        const breakStartMins = timeToMinutes(breakStartStr);
        const breakEndMins = timeToMinutes(breakEndStr);
        if (current < breakEndMins && current + slotDuration > breakStartMins) {
          continue;
        }
      }

      const startUtc = argentinaTimeToUtc(dateStr, timeStr);
      const endUtc = addMinutes(startUtc, slotDuration);

      candidateSlots.push({ time: timeStr, startUtc, endUtc });
    }

    if (candidateSlots.length === 0) {
      return {
        date: dateStr,
        dayOfWeek: getArgentinaDayOfWeek(argentinaTimeToUtc(dateStr, "12:00")),
        isOpen: true,
        slots: [],
      };
    }

    const dayStartUtc = candidateSlots[0].startUtc;
    const dayEndUtc = candidateSlots[candidateSlots.length - 1].endUtc;

    // 4. Buscar bloqueos de agenda en el rango del día
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        startTime: { lt: dayEndUtc },
        endTime: { gt: dayStartUtc },
      },
    });

    // 5. Buscar reservas activas en el rango del día
    // Una reserva está activa si:
    // - status in ['CONFIRMADA', 'PAGO_CONFIRMADO', 'COMPROBANTE_ENVIADO']
    // - O status == 'PENDIENTE_PAGO' Y expiresAt > now
    const activeAppointments = await prisma.appointment.findMany({
      where: {
        startTime: { lt: dayEndUtc },
        endTime: { gt: dayStartUtc },
        OR: [
          {
            status: {
              in: ["CONFIRMADA", "PAGO_CONFIRMADO", "COMPROBANTE_ENVIADO"],
            },
          },
          {
            status: "PENDIENTE_PAGO",
            expiresAt: { gt: now },
          },
        ],
      },
    });

    const minNoticeLimit = addHours(now, profile.minNoticeHours);

    // 6. Evaluar disponibilidad de cada slot
    const slots: TimeSlot[] = candidateSlots.map((candidate) => {
      // Regla de anticipación mínima y fechas pasadas
      if (isBefore(candidate.startUtc, minNoticeLimit)) {
        return {
          time: candidate.time,
          startTimeUtc: candidate.startUtc,
          endTimeUtc: candidate.endUtc,
          available: false,
          reason: "Horario no disponible por anticipación mínima",
        };
      }

      // Colisión con bloqueos
      const hasBlock = blocks.some(
        (b) => b.startTime < candidate.endUtc && b.endTime > candidate.startUtc
      );
      if (hasBlock) {
        return {
          time: candidate.time,
          startTimeUtc: candidate.startUtc,
          endTimeUtc: candidate.endUtc,
          available: false,
          reason: "Horario bloqueado",
        };
      }

      // Colisión con turnos activos
      const hasConflict = activeAppointments.some(
        (app) => app.startTime < candidate.endUtc && app.endTime > candidate.startUtc
      );
      if (hasConflict) {
        return {
          time: candidate.time,
          startTimeUtc: candidate.startUtc,
          endTimeUtc: candidate.endUtc,
          available: false,
          reason: "Horario reservado",
        };
      }

      return {
        time: candidate.time,
        startTimeUtc: candidate.startUtc,
        endTimeUtc: candidate.endUtc,
        available: true,
      };
    });

    return {
      date: dateStr,
      dayOfWeek: getArgentinaDayOfWeek(argentinaTimeToUtc(dateStr, "12:00")),
      isOpen: true,
      slots,
    };
  }

  /**
   * Obtiene disponibilidad para un rango de fechas (ej. una semana de lunes a domingo).
   */
  static async getSlotsForRange(dateStrings: string[]): Promise<DayAvailability[]> {
    try {
      await AppointmentService.cleanExpiredAppointments();
    } catch {}
    const results: DayAvailability[] = [];
    for (const d of dateStrings) {
      results.push(await this.getSlotsForDate(d));
    }
    return results;
  }
}
