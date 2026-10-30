import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { PaymentService } from "@/lib/services/payment.service";
import prisma from "@/lib/prisma";
import { EmailService } from "@/lib/services/email.service";
import { createPatientToken } from "@/lib/patient-auth";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    const { paymentId, rejectionReason } = await req.json();

    if (!paymentId || !rejectionReason) {
      return NextResponse.json(
        { success: false, error: "Se requiere paymentId y motivo de rechazo." },
        { status: 400 }
      );
    }

    const updatedPayment = await PaymentService.rejectPayment(paymentId, rejectionReason, admin.sub);

    const appointment = await prisma.appointment.findUnique({
      where: { id: updatedPayment.appointmentId },
      include: {
        patient: true,
        accessTokens: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (appointment) {
      let token = appointment.accessTokens[0]?.id;
      try {
        token = await createPatientToken(appointment.id, 720);
      } catch (tokenErr) {
        console.error("[Reject Payment] Error al generar token:", tokenErr);
      }

      try {
        await EmailService.sendPaymentRejected({
          to: appointment.patient.email,
          patientName: appointment.patient.fullName,
          publicCode: appointment.publicCode,
          reason: rejectionReason,
          token: token || appointment.id,
        });
      } catch (err) {
        console.error("Error al despachar email de comprobante rechazado:", err);
      }
    }

    return NextResponse.json({ success: true, payment: updatedPayment });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || "Error al rechazar pago" }, { status: 500 });
  }
}
