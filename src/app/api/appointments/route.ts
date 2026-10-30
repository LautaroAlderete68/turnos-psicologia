import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppointmentService, SlotUnavailableError } from "@/lib/services/appointment.service";
import { checkRateLimit } from "@/lib/rate-limit";
import { EmailService } from "@/lib/services/email.service";
import { formatDateTimeArgentina, argentinaTimeToUtc } from "@/lib/timezone";

const appointmentSchema = z.object({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
  timeStr: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:mm)"),
  modality: z.enum(["PRESENCIAL", "VIRTUAL"]),
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100),
  email: z.string().email("Correo electrónico inválido").toLowerCase(),
  phone: z.string().min(6, "Teléfono inválido").max(30),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: "Debés aceptar el aviso de privacidad para continuar" }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting por IP: máximo 15 intentos de reserva por hora
    const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimit = checkRateLimit(`appointment:${ip}`, 15, 60 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Demasiadas solicitudes de reserva desde esta conexión. Por favor intentá más tarde.",
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validated = appointmentSchema.parse(body);

    const result = await AppointmentService.createAppointment(validated);

    // Enviar notificación por email en segundo plano
    const dateTimeFormatted = formatDateTimeArgentina(
      argentinaTimeToUtc(validated.dateStr, validated.timeStr)
    );
    try {
      await EmailService.sendBookingCreated({
        to: validated.email,
        patientName: validated.fullName,
        publicCode: result.publicCode,
        dateTimeFormatted,
        modality: validated.modality === "PRESENCIAL" ? "Presencial en consultorio" : "Atención virtual",
        price: result.price,
        token: result.token,
      });
    } catch (err) {
      console.error("[Appointments API] Error al despachar email de reserva:", err);
    }

    return NextResponse.json({
      success: true,
      data: {
        appointmentId: result.appointmentId,
        publicCode: result.publicCode,
        token: result.token,
        expiresAt: result.expiresAt,
        price: result.price,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || "Datos del formulario inválidos" },
        { status: 400 }
      );
    }

    if (error instanceof SlotUnavailableError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 } // Conflict: el turno fue tomado concurrentemente
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar la reserva" },
      { status: 400 }
    );
  }
}
