import { NextRequest, NextResponse } from "next/server";
import { AppointmentService, SlotUnavailableError } from "@/lib/services/appointment.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, token, dateStr, timeStr } = body;

    if (!appointmentId || !token || !dateStr || !timeStr) {
      return NextResponse.json(
        { success: false, error: "Datos incompletos para la reprogramación." },
        { status: 400 }
      );
    }

    const result = await AppointmentService.rescheduleAppointment({
      appointmentId,
      token,
      dateStr,
      timeStr,
    });

    return NextResponse.json({
      success: true,
      message: "Turno reprogramado exitosamente",
      newStartTime: result.newStartTime,
      newEndTime: result.newEndTime,
    });
  } catch (error: any) {
    console.error("Error en reschedule route:", error);
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Error al reprogramar el turno." },
      { status: 400 }
    );
  }
}
