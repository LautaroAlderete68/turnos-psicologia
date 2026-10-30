import { addMinutes, addHours } from "date-fns";
import crypto from "crypto";
import prisma from "../prisma";
import { argentinaTimeToUtc, isPastUtc, formatDateTimeArgentina } from "../timezone";
import { hashToken, generateRawToken } from "../patient-auth";
import { EmailService } from "./email.service";

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
    const minNoticeMins = profile.minNoticeMinutes ?? (profile.minNoticeHours ? profile.minNoticeHours * 60 : 30);
    const minNoticeLimit = addMinutes(now, minNoticeMins);
    if (startTimeUtc < minNoticeLimit) {
      const noticeText = minNoticeMins >= 60 ? `${Math.round(minNoticeMins / 60)} hora(s)` : `${minNoticeMins} minutos`;
      throw new Error(`Se requiere una anticipación mínima de ${noticeText} para reservar.`);
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
          price: profile.sessionPrice,
          expiresAt,
        },
      });

      // 6. Crear el registro de pago asociado
      await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          status: "PENDIENTE",
          amount: profile.sessionPrice,
        },
      });

      // 7. Crear el token criptográfico de acceso del paciente
      await tx.patientAccessToken.create({
        data: {
          appointmentId: appointment.id,
          tokenHash,
          expiresAt: addHours(now, 720), // Token válido por 30 días
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
        price: profile.sessionPrice,
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

  /**
   * Permite reprogramar un turno confirmado respetando la anticipación mínima en horas.
   */
  static async rescheduleAppointment(input: {
    appointmentId: string;
    token: string;
    dateStr: string; // "YYYY-MM-DD"
    timeStr: string; // "14:00"
  }): Promise<{ success: boolean; newStartTime: Date; newEndTime: Date }> {
    const { appointmentId, token, dateStr, timeStr } = input;

    // 1. Validar turno y token de acceso del paciente
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        payment: true,
        accessTokens: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!appointment) {
      throw new Error("Turno no encontrado.");
    }

    const hashedInputToken = hashToken(token);
    const validToken = appointment.accessTokens.find(
      (t) => t.tokenHash === hashedInputToken && t.expiresAt > new Date()
    );

    if (!validToken) {
      throw new Error("Acceso no autorizado o enlace de turno expirado.");
    }

    // 2. Solo turnos CONFIRMADOS pueden ser reprogramados
    if (appointment.status !== "CONFIRMADA" && appointment.payment?.status !== "APROBADO") {
      throw new Error("Solo los turnos confirmados pueden ser reprogramados.");
    }

    const profile = await prisma.psychologistProfile.findFirst();
    if (!profile) {
      throw new Error("Perfil profesional no configurado.");
    }

    const now = new Date();

    // 3. Verificar anticipación mínima para reprogramar (en horas)
    const noticeHours = profile.rescheduleNoticeHours ?? 24;
    const msUntilAppointment = appointment.startTime.getTime() - now.getTime();
    const hoursUntil = msUntilAppointment / (1000 * 60 * 60);

    if (hoursUntil < noticeHours) {
      throw new Error(
        `Las reprogramaciones deben realizarse con al menos ${noticeHours} horas de anticipación según las políticas del consultorio.`
      );
    }

    // 4. Calcular nuevo horario en UTC
    const newStartTimeUtc = argentinaTimeToUtc(dateStr, timeStr);
    const newEndTimeUtc = addMinutes(newStartTimeUtc, profile.sessionDuration);

    if (isPastUtc(newStartTimeUtc)) {
      throw new Error("No se puede reprogramar a una fecha u horario pasado.");
    }

    // Anticipación mínima para el nuevo horario
    const minNoticeMins = profile.minNoticeMinutes ?? (profile.minNoticeHours ? profile.minNoticeHours * 60 : 30);
    const minNoticeLimit = addMinutes(now, minNoticeMins);
    if (newStartTimeUtc < minNoticeLimit) {
      const noticeText = minNoticeMins >= 60 ? `${Math.round(minNoticeMins / 60)} hora(s)` : `${minNoticeMins} minutos`;
      throw new Error(`El nuevo horario debe tener al menos ${noticeText} de anticipación.`);
    }

    // 5. Transacción de reprogramación con verificación de colisiones
    await prisma.$transaction(async (tx) => {
      // Verificar bloqueos
      const blockConflict = await tx.scheduleBlock.findFirst({
        where: {
          startTime: { lt: newEndTimeUtc },
          endTime: { gt: newStartTimeUtc },
        },
      });

      if (blockConflict) {
        throw new SlotUnavailableError("El nuevo horario seleccionado se encuentra bloqueado por la profesional.");
      }

      // Verificar conflictos de turno con otras reservas (excluyendo este turno)
      const conflict = await tx.appointment.findFirst({
        where: {
          id: { not: appointment.id },
          startTime: { lt: newEndTimeUtc },
          endTime: { gt: newStartTimeUtc },
          OR: [
            {
              status: { in: ["CONFIRMADA", "PAGO_CONFIRMADO", "COMPROBANTE_ENVIADO"] },
            },
            {
              status: "PENDIENTE_PAGO",
              expiresAt: { gt: now },
            },
          ],
        },
      });

      if (conflict) {
        throw new SlotUnavailableError("El nuevo horario seleccionado ya no está disponible.");
      }

      // Actualizar turno
      await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          startTime: newStartTimeUtc,
          endTime: newEndTimeUtc,
        },
      });

      // Registrar en auditoría
      await tx.auditLog.create({
        data: {
          action: "APPOINTMENT_RESCHEDULED",
          entity: "Appointment",
          entityId: appointment.id,
          performedBy: `PATIENT:${appointment.publicCode}`,
          details: JSON.stringify({
            previousStart: appointment.startTime,
            newStart: newStartTimeUtc,
            previousEnd: appointment.endTime,
            newEnd: newEndTimeUtc,
          }),
        },
      });
    });

    // Enviar correo de notificación
    try {
      const oldFormatted = formatDateTimeArgentina(appointment.startTime);
      const newFormatted = formatDateTimeArgentina(newStartTimeUtc);
      const modalityText =
        appointment.modality === "PRESENCIAL"
          ? "Presencial en consultorio"
          : "Atención Virtual (Google Meet)";

      await EmailService.sendAppointmentRescheduled({
        to: appointment.patient.email,
        patientName: appointment.patient.fullName,
        publicCode: appointment.publicCode,
        oldDateTimeFormatted: oldFormatted,
        newDateTimeFormatted: newFormatted,
        modality: modalityText,
        token,
        meetingUrl: appointment.meetingUrl,
      });
    } catch (emailErr) {
      console.error("Error al enviar email de reprogramación:", emailErr);
    }

    return {
      success: true,
      newStartTime: newStartTimeUtc,
      newEndTime: newEndTimeUtc,
    };
  }
}
