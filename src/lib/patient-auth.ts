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
 * Devuelve el token en texto plano que irá en el enlace único (el cual no se guarda en texto plano en la BD).
 */
export async function createPatientToken(appointmentId: string, hoursValid = 72): Promise<string> {
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
 * Valida el token del paciente. Si es válido y no expiró, retorna el turno y sus datos asociados.
 */
export async function validatePatientToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const tokenRecord = await prisma.patientAccessToken.findUnique({
    where: { tokenHash },
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

  if (new Date() > tokenRecord.expiresAt) {
    return null;
  }

  return tokenRecord.appointment;
}
