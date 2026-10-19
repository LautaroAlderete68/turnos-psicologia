import prisma from "../prisma";
import {
  storageProvider,
  validateFileMagicBytes,
  SupportedMimeType,
} from "./storage.service";

export interface AttachProofInput {
  appointmentId: string;
  buffer: Buffer;
  originalFilename: string;
}

export class PaymentService {
  /**
   * Adjunta un comprobante de pago a una reserva.
   * Valida estrictamente los magic bytes y el tamaño del archivo.
   * IMPORTANTE: No aprueba el pago automáticamente; pasa a COMPROBANTE_RECIBIDO / COMPROBANTE_ENVIADO.
   */
  static async attachProof(input: AttachProofInput) {
    // 1. Validar Magic Bytes y tamaño del archivo
    const validation = validateFileMagicBytes(input.buffer);
    if (!validation.isValid || !validation.mimeType) {
      throw new Error(validation.error || "El archivo enviado no es un comprobante válido.");
    }

    // 2. Obtener reserva y su pago asociado
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: { payment: true },
    });

    if (!appointment) {
      throw new Error("Reserva no encontrada.");
    }

    if (appointment.status === "CANCELADA") {
      throw new Error("No se pueden adjuntar comprobantes a un turno cancelado.");
    }

    let payment = appointment.payment;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: appointment.price,
          status: "PENDIENTE",
        },
      });
    }

    // 3. Guardar en almacenamiento privado
    const saveResult = await storageProvider.save(
      input.buffer,
      input.originalFilename,
      validation.mimeType
    );

    // 4. Crear registro en BD y actualizar estados
    const proof = await prisma.paymentProof.create({
      data: {
        paymentId: payment.id,
        storageKey: saveResult.storageKey,
        originalFilename: input.originalFilename,
        mimeType: saveResult.mimeType,
        sizeBytes: saveResult.sizeBytes,
      },
    });

    // Estado del pago pasa a COMPROBANTE_RECIBIDO (NO aprobado)
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPROBANTE_RECIBIDO",
      },
    });

    // Estado del turno pasa a COMPROBANTE_ENVIADO
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "COMPROBANTE_ENVIADO",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "PROOF_UPLOADED",
        entity: "PaymentProof",
        entityId: proof.id,
        performedBy: "PATIENT",
        details: JSON.stringify({
          originalFilename: input.originalFilename,
          mimeType: saveResult.mimeType,
          sizeBytes: saveResult.sizeBytes,
        }),
      },
    });

    return {
      proofId: proof.id,
      storageKey: proof.storageKey,
      mimeType: proof.mimeType,
      uploadedAt: proof.uploadedAt,
    };
  }

  /**
   * Acción de la psicóloga: Aprobar el comprobante y confirmar el turno.
   */
  static async approvePayment(paymentId: string, adminUserId?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { appointment: true },
    });

    if (!payment) {
      throw new Error("Pago no encontrado.");
    }

    const reviewedAt = new Date();

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "APROBADO",
        reviewedAt,
        rejectionReason: null,
      },
    });

    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: {
        status: "CONFIRMADA",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_APPROVED",
        entity: "Payment",
        entityId: paymentId,
        performedBy: adminUserId ? `ADMIN:${adminUserId}` : "ADMIN",
        details: JSON.stringify({ reviewedAt }),
      },
    });

    return updatedPayment;
  }

  /**
   * Acción de la psicóloga: Rechazar el comprobante con motivo obligatorio.
   */
  static async rejectPayment(paymentId: string, rejectionReason: string, adminUserId?: string) {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error("Debe indicarse un motivo de rechazo claro.");
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { appointment: true },
    });

    if (!payment) {
      throw new Error("Pago no encontrado.");
    }

    const reviewedAt = new Date();

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "RECHAZADO",
        reviewedAt,
        rejectionReason: rejectionReason.trim(),
      },
    });

    // El turno vuelve a quedar pendiente de pago para que el paciente pueda reintentar
    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: {
        status: "PENDIENTE_PAGO",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "PAYMENT_REJECTED",
        entity: "Payment",
        entityId: paymentId,
        performedBy: adminUserId ? `ADMIN:${adminUserId}` : "ADMIN",
        details: JSON.stringify({ reason: rejectionReason, reviewedAt }),
      },
    });

    return updatedPayment;
  }

  /**
   * Verifica si un usuario (sea admin o paciente con su token) tiene permiso para ver/descargar un comprobante.
   */
  static async canAccessProof(proofId: string, options: { isAdmin?: boolean; patientToken?: string }): Promise<boolean> {
    if (options.isAdmin) {
      return true;
    }

    if (!options.patientToken) {
      return false;
    }

    const proof = await prisma.paymentProof.findUnique({
      where: { id: proofId },
      include: {
        payment: {
          include: {
            appointment: {
              include: {
                accessTokens: true,
              },
            },
          },
        },
      },
    });

    if (!proof) return false;

    // Verificar si el token provisto coincide con alguno de los hashes válidos de la reserva
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(options.patientToken).digest("hex");

    const validToken = proof.payment.appointment.accessTokens.some(
      (t) => t.tokenHash === tokenHash && t.expiresAt > new Date()
    );

    return validToken;
  }
}
