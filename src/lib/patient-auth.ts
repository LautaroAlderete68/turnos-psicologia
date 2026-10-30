import crypto from "crypto";
import { addHours } from "date-fns";
import prisma from "./prisma";

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Genera y almacena un token criptográfico seguro para el acceso de un paciente a su turno.
 * Devuelve el token en texto plano que irá en el enlace único.
 * Por defecto es válido por 720 horas (30 días).
 */
export async function createPatientToken(appointmentId: string, hoursValid = 720): Promise<string> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addHours(new Date(), hoursValid);

  await prisma.patientAccessToken.create({
    data: {
      appointmentId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Valida el token del paciente.
 * Soporta tanto tokens en texto plano (verificados contra tokenHash)
 * como identificadores directos (para enlaces generados con ID de token).
 * Si el token expiró pero la cita sigue vigente, renueva el acceso automáticamente.
 */
export async function validatePatientToken(token: string) {
  if (!token || typeof token !== "string" || token.trim().length < 8) {
    return null;
  }

  const cleanToken = token.trim();
  const tokenHash = hashToken(cleanToken);

  const tokenRecord = await prisma.patientAccessToken.findFirst({
    where: {
      OR: [
        { tokenHash },
        { id: cleanToken },
      ],
    },
    include: {
      appointment: {
        include: {
          patient: true,
          payment: {
            include: {
              proofs: {
                orderBy: { uploadedAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!tokenRecord) {
    return null;
  }

  // Si la fecha actual supera expiresAt, verificamos si el turno aún está vigente o activo
  if (new Date() > tokenRecord.expiresAt) {
    const appointmentEndTime = new Date(tokenRecord.appointment.endTime);
    const gracePeriodEnd = new Date(
      Math.max(
        appointmentEndTime.getTime() + 7 * 24 * 60 * 60 * 1000,
        tokenRecord.createdAt.getTime() + 60 * 24 * 60 * 60 * 1000
      )
    );

    if (new Date() <= gracePeriodEnd && tokenRecord.appointment.status !== "CANCELADA") {
      try {
        await prisma.patientAccessToken.update({
          where: { id: tokenRecord.id },
          data: { expiresAt: gracePeriodEnd },
        });
      } catch (e) {
        console.error("[validatePatientToken] Error al extender vigencia de token:", e);
      }
    } else {
      return null;
    }
  }

  return tokenRecord.appointment;
}
