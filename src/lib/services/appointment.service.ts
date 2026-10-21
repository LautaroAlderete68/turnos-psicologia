import { addMinutes, addHours } from "date-fns";
import crypto from "crypto";
import prisma from "../prisma";
import { argentinaTimeToUtc, isPastUtc, formatDateTimeArgentina } from "../timezone";
import { hashToken, generateRawToken } from "../patient-auth";
import { SESSION_PRICE } from "../constants";

export class SlotUnavailableError extends Error {
  constructor(message = "El horario seleccionado ya no se encuentra disponible.") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export interface CreateAppointmentInput {
  dateStr: string; // "YYYY-MM-DD"
  timeStr: string; // "14:00"
  modality: "PRESENCIAL" | "VIRTUAL";
  fullName: string;
  email: string;
  phone: string;
  privacyAccepted: boolean;
}

export interface CreateAppointmentResult {
  appointmentId: string;
  publicCode: string;
  token: string;
  expiresAt: Date;
  price: number;
}

export class AppointmentService {
  /**
   * Genera un código público legible de reserva (ej: TRN-7F8A2K).
   */
  private static generatePublicCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "TRN-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return code;
  }

  /**
   * Crea una reserva de turno con control transaccional estricto de concurrencia.
   * Si dos usuarios solicitan el mismo horario en simultáneo, solo uno tiene éxito y el otro recibe SlotUnavailableError.
   */
  static async createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
    if (!input.privacyAccepted) {
      throw new Error("Es necesario aceptar el aviso de privacidad para solicitar un turno.");
    }

    const profile = await prisma.psychologistProfile.findFirst();
    if (!profile) {
      throw new Error("Perfil profesional no configurado.");
    }

    if (input.modality === "PRESENCIAL" && !profile.allowPresencial) {
      throw new Error("La atención presencial no está habilitada.");
    }
    if (input.modality === "VIRTUAL" && !profile.allowVirtual) {
      throw new Error("La atención virtual no está habilitada.");
    }

    const now = new Date();
    const startTimeUtc = argentinaTimeToUtc(input.dateStr, input.timeStr);
    const endTimeUtc = addMinutes(startTimeUtc, profile.sessionDuration);

    // Validación: No permitir turnos en el pasado
    if (isPastUtc(startTimeUtc)) {
      throw new Error("No se pueden reservar turnos en fechas u horarios pasados.");
    }

    // Validación: Anticipación mínima
    const minNoticeLimit = addHours(now, profile.minNoticeHours);
    if (startTimeUtc < minNoticeLimit) {
      throw new Error(`Se requiere una anticipación mínima de ${profile.minNoticeHours} horas para reservar.`);
    }

    const expiresAt = addMinutes(now, profile.pendingExpirationMinutes);
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const publicCode = this.generatePublicCode();

    // Operación transaccional con verificación de colisiones en tiempo real
    const result = await prisma.$transaction(async (tx) => {
      // 1. Marcar automáticamente turnos pendientes vencidos
      await tx.appointment.updateMany({
        where: {
          status: "PENDIENTE_PAGO",
          expiresAt: { lte: now },
        },
        data: {
          status: "CANCELADA",
          cancellationReason: "Reserva expirada automáticamente por falta de pago dentro del plazo límite",
        },
      });

      // 2. Verificar bloqueos de agenda
      const blockConflict = await tx.scheduleBlock.findFirst({
        where: {
          startTime: { lt: endTimeUtc },
          endTime: { gt: startTimeUtc },
        },
      });

      if (blockConflict) {
        throw new SlotUnavailableError("El horario seleccionado se encuentra bloqueado por la profesional.");
      }

      // 3. Verificar superposición con reservas activas (Confirmadas, con comprobante o pendientes no expiradas)
      const existingConflict = await tx.appointment.findFirst({
        where: {
          startTime: { lt: endTimeUtc },
          endTime: { gt: startTimeUtc },
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

      if (existingConflict) {
        throw new SlotUnavailableError("El horario seleccionado ya no se encuentra disponible. Por favor seleccioná otro turno.");
      }

      // 4. Buscar o crear el paciente
      const normalizedEmail = input.email.trim().toLowerCase();
      let patient = await tx.patient.findFirst({
        where: { email: normalizedEmail },
      });

      if (patient) {
        patient = await tx.patient.update({
          where: { id: patient.id },
          data: {
            fullName: input.fullName.trim(),
            phone: input.phone.trim(),
          },
        });
      } else {
        patient = await tx.patient.create({
          data: {
            fullName: input.fullName.trim(),
            email: normalizedEmail,
            phone: input.phone.trim(),
            privacyAccepted: true,
          },
        });
      }

      // 5. Crear la reserva
      const appointment = await tx.appointment.create({
        data: {
          publicCode,
          patientId: patient.id,
          startTime: startTimeUtc,
          endTime: endTimeUtc,
          modality: input.modality,
          status: "PENDIENTE_PAGO",
          price: SESSION_PRICE,
          expiresAt,
        },
      });

      // 6. Crear el registro de pago asociado
      await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          status: "PENDIENTE",
          amount: SESSION_PRICE,
        },
      });

      // 7. Crear el token criptográfico de acceso del paciente
      await tx.patientAccessToken.create({
        data: {
          appointmentId: appointment.id,
          tokenHash,
          expiresAt: addHours(now, 72), // Token válido por 72 horas
        },
      });

      // 8. Registrar log de auditoría
      await tx.auditLog.create({
        data: {
          action: "APPOINTMENT_CREATED",
          entity: "Appointment",
          entityId: appointment.id,
          performedBy: "PATIENT",
          details: JSON.stringify({
            publicCode,
            modality: input.modality,
            startTimeUtc,
          }),
        },
      });

      return {
        appointmentId: appointment.id,
        publicCode,
        token: rawToken,
        expiresAt,
        price: SESSION_PRICE,
      };
    });

    return result;
  }

  /**
   * Libera automáticamente las reservas en estado PENDIENTE_PAGO que hayan superado su expiresAt.
   */
  static async cleanExpiredAppointments(): Promise<number> {
    const now = new Date();
    const updateResult = await prisma.appointment.updateMany({
      where: {
        status: "PENDIENTE_PAGO",
        expiresAt: { lte: now },
      },
      data: {
        status: "CANCELADA",
        cancellationReason: "Reserva expirada automáticamente por superar el tiempo límite de pago",
      },
    });

    return updateResult.count;
  }

  /**
   * Permite cancelar un turno (tanto paciente titular como psicóloga).
   */
  static async cancelAppointment(
    appointmentId: string,
    reason: string,
    performedBy: "PATIENT" | "ADMIN"
  ): Promise<boolean> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error("Turno no encontrado.");
    }

    if (appointment.status === "CANCELADA" || appointment.status === "COMPLETADA") {
      throw new Error(`El turno ya se encuentra en estado ${appointment.status}.`);
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELADA",
        cancellationReason: reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "APPOINTMENT_CANCELLED",
        entity: "Appointment",
        entityId: appointmentId,
        performedBy,
        details: JSON.stringify({ reason }),
      },
    });

    return true;
  }
}
