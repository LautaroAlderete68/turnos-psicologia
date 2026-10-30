import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { PaymentService } from "@/lib/services/payment.service";
import prisma from "@/lib/prisma";
import { EmailService } from "@/lib/services/email.service";
import { MeetingService } from "@/lib/services/meeting.service";
import { formatDateTimeArgentina } from "@/lib/timezone";
import { createPatientToken } from "@/lib/patient-auth";

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

    if (appointment) {
      let meetingUrl: string | null = appointment.meetingUrl;

      // Si el turno es VIRTUAL y aún no tiene sala asignada, generar una automáticamente
      if (appointment.modality === "VIRTUAL" && !meetingUrl) {
        try {
          const meeting = await MeetingService.createMeeting({
            appointmentId: appointment.id,
            publicCode: appointment.publicCode,
            patientName: appointment.patient.fullName,
            patientEmail: appointment.patient.email,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
          });

          if (meeting?.url) {
            meetingUrl = meeting.url;
            await prisma.appointment.update({
              where: { id: appointment.id },
              data: { meetingUrl },
            });
            console.log(`[Approve Payment] Sala virtual asignada (${meeting.provider}): ${meetingUrl}`);
          }
        } catch (meetingErr) {
          console.error("[Approve Payment] Error al generar sala virtual:", meetingErr);
        }
      }

      // Generar token criptográfico nuevo de acceso para el enlace (válido por 30 días)
      let token = appointment.accessTokens[0]?.id;
      try {
        token = await createPatientToken(appointment.id, 720);
      } catch (tokenErr) {
        console.error("[Approve Payment] Error al generar nuevo token de paciente:", tokenErr);
      }

      // Notificar al paciente asegurando que Vercel espere el envío
      try {
        await EmailService.sendBookingConfirmed({
          to: appointment.patient.email,
          patientName: appointment.patient.fullName,
          publicCode: appointment.publicCode,
          dateTimeFormatted: formatDateTimeArgentina(appointment.startTime),
          modality: appointment.modality === "PRESENCIAL" ? "Presencial en consultorio" : "Atención virtual",
          token: token || appointment.id,
          meetingUrl,
        });
      } catch (err) {
        console.error("[Approve Payment] Error al despachar email de turno confirmado:", err);
      }
    }

    return NextResponse.json({ success: true, payment: updatedPayment });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || "Error al aprobar pago" }, { status: 500 });
  }
}
