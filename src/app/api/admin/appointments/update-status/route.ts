import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    const { appointmentId, status, adminNotes, cancellationReason } = await req.json();

    if (!appointmentId) {
      return NextResponse.json({ success: false, error: "appointmentId requerido" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (adminNotes !== undefined) dataToUpdate.adminNotes = adminNotes;
    if (cancellationReason !== undefined) dataToUpdate.cancellationReason = cancellationReason;

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: dataToUpdate,
    });

    await prisma.auditLog.create({
      data: {
        action: "APPOINTMENT_STATUS_UPDATED",
        entity: "Appointment",
        entityId: appointmentId,
        performedBy: `ADMIN:${admin.sub}`,
        details: JSON.stringify(dataToUpdate),
      },
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || "Error al actualizar turno" }, { status: 500 });
  }
}
