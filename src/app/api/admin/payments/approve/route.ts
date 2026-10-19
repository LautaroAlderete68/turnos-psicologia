import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { PaymentService } from "@/lib/services/payment.service";
import prisma from "@/lib/prisma";
import { EmailService } from "@/lib/services/email.service";
import { formatDateTimeArgentina } from "@/lib/timezone";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ success: false, error: "paymentId requerido" }, { status: 400 });
    }

    const updatedPayment = await PaymentService.approvePayment(paymentId, admin.sub);

    // Obtener datos para notificación al paciente
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

    if (appointment && appointment.accessTokens.length > 0) {
      // Notificar al paciente en segundo plano
      EmailService.sendBookingConfirmed({
        to: appointment.patient.email,
        patientName: appointment.patient.fullName,
        publicCode: appointment.publicCode,
        dateTimeFormatted: formatDateTimeArgentina(appointment.startTime),
        modality: appointment.modality === "PRESENCIAL" ? "Presencial en consultorio" : "Atención virtual",
        token: appointment.accessTokens[0].id, // Enlace seguro
      }).catch((err) => console.error("Error al despachar email de turno confirmado:", err));
    }

    return NextResponse.json({ success: true, payment: updatedPayment });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || "Error al aprobar pago" }, { status: 500 });
  }
}
