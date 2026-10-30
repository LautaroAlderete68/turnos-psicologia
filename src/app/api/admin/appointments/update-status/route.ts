import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EmailService } from "@/lib/services/email.service";
import { MeetingService } from "@/lib/services/meeting.service";
import { formatDateTimeArgentina } from "@/lib/timezone";
import { createPatientToken, validatePatientToken } from "@/lib/patient-auth";

export async function POST(req: NextRequest) {
  try {
    const adminSession = await getAdminSession();
    let isAuthorized = !!adminSession;
    let performedBy = adminSession ? `ADMIN:${adminSession.sub}` : "PATIENT";

    const body = await req.json();
    const { appointmentId, status, adminNotes, cancellationReason, meetingUrl, token } = body;

    if (!appointmentId) {
      return NextResponse.json({ success: false, error: "appointmentId requerido" }, { status: 400 });
    }

    // Si no es administrador, verificar si tiene token válido de paciente para cancelar su propio turno
    if (!isAuthorized && token && status === "CANCELADA") {
      const validApp = await validatePatientToken(token);
      if (validApp && validApp.id === appointmentId) {
        isAuthorized = true;
        performedBy = `PATIENT:${validApp.publicCode}`;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    // Obtener turno actual antes de la actualización
    const currentAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        payment: true,
        accessTokens: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!currentAppointment) {
      return NextResponse.json({ success: false, error: "Turno no encontrado" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (adminNotes !== undefined) dataToUpdate.adminNotes = adminNotes;
    if (cancellationReason !== undefined) dataToUpdate.cancellationReason = cancellationReason;
    if (meetingUrl !== undefined) dataToUpdate.meetingUrl = meetingUrl;

    // Si se pasa a CONFIRMADA y el turno es virtual sin sala, resolvemos Google Meet
    if (status === "CONFIRMADA" && currentAppointment.modality === "VIRTUAL") {
      let resolvedMeet = dataToUpdate.meetingUrl || currentAppointment.meetingUrl;
      if (!resolvedMeet) {
        try {
          const meeting = await MeetingService.createMeeting({
            appointmentId: currentAppointment.id,
            publicCode: currentAppointment.publicCode,
            patientName: currentAppointment.patient.fullName,
            patientEmail: currentAppointment.patient.email,
            startTime: currentAppointment.startTime,
            endTime: currentAppointment.endTime,
          });
          if (meeting?.url) {
            resolvedMeet = meeting.url;
            dataToUpdate.meetingUrl = resolvedMeet;
          }
        } catch (meetingErr) {
          console.error("[update-status] Error al generar sala virtual:", meetingErr);
        }
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: dataToUpdate,
    });

    await prisma.auditLog.create({
      data: {
        action: "APPOINTMENT_STATUS_UPDATED",
        entity: "Appointment",
        entityId: appointmentId,
        performedBy,
        details: JSON.stringify(dataToUpdate),
      },
    });

    // ========================================================
    // ENVÍO DE NOTIFICACIÓN POR EMAIL AL PACIENTE
    // ========================================================
    if (status && status !== currentAppointment.status) {
      const dateTimeFormatted = formatDateTimeArgentina(currentAppointment.startTime);

      try {
        if (status === "CANCELADA") {
          await EmailService.sendBookingCancelled({
            to: currentAppointment.patient.email,
            patientName: currentAppointment.patient.fullName,
            publicCode: currentAppointment.publicCode,
            dateTimeFormatted,
            reason: cancellationReason || updated.cancellationReason || undefined,
          });
          console.log(`[update-status] Email de cancelación enviado a ${currentAppointment.patient.email}`);
        } else if (status === "CONFIRMADA") {
          let tokenForPatient = currentAppointment.accessTokens[0]?.id;
          try {
            tokenForPatient = await createPatientToken(currentAppointment.id, 720);
          } catch (tErr) {
            console.error("[update-status] Error generando token:", tErr);
          }

          await EmailService.sendBookingConfirmed({
            to: currentAppointment.patient.email,
            patientName: currentAppointment.patient.fullName,
            publicCode: currentAppointment.publicCode,
            dateTimeFormatted,
            modality: currentAppointment.modality === "PRESENCIAL" ? "Presencial en consultorio" : "Atención virtual",
            token: tokenForPatient || currentAppointment.id,
            meetingUrl: dataToUpdate.meetingUrl || currentAppointment.meetingUrl,
          });
          console.log(`[update-status] Email de confirmación enviado a ${currentAppointment.patient.email}`);
        } else {
          // Cualquier otro estado manual (COMPLETADA, PENDIENTE_PAGO, AUSENTE, etc.)
          await EmailService.sendAppointmentStatusUpdated({
            to: currentAppointment.patient.email,
            patientName: currentAppointment.patient.fullName,
            publicCode: currentAppointment.publicCode,
            newStatus: status,
            dateTimeFormatted,
            note: adminNotes || cancellationReason || undefined,
          });
          console.log(`[update-status] Email de actualización (${status}) enviado a ${currentAppointment.patient.email}`);
        }
      } catch (emailErr) {
        console.error("[update-status] Error al despachar email de notificación:", emailErr);
      }
    }

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error: any) {
    console.error("Error en update-status:", error);
    return NextResponse.json({ success: false, error: error.message || "Error al actualizar turno" }, { status: 500 });
  }
}
