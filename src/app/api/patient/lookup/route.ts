import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createPatientToken } from "@/lib/patient-auth";
import { EmailService } from "@/lib/services/email.service";
import { formatDateTimeArgentina } from "@/lib/timezone";
import { checkRateLimit } from "@/lib/rate-limit";

const lookupSchema = z.object({
  email: z.string().email("Correo electrónico inválido").toLowerCase(),
  publicCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimit = checkRateLimit(`lookup:${ip}`, 10, 15 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Demasiadas consultas. Por favor esperá unos minutos." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, publicCode } = lookupSchema.parse(body);

    const normalizedEmail = email.trim().toLowerCase();

    // Caso A: Ingresó Email + Código de turno (ej: TRN-8A2F9K)
    if (publicCode && publicCode.trim().length > 0) {
      const normalizedCode = publicCode.trim().toUpperCase();

      const appointment = await prisma.appointment.findFirst({
        where: {
          publicCode: normalizedCode,
          patient: {
            email: normalizedEmail,
          },
        },
        include: { patient: true },
      });

      if (!appointment) {
        return NextResponse.json(
          {
            success: false,
            error: "No encontramos ningún turno asociado a ese correo y código. Verificá los datos ingresados.",
          },
          { status: 404 }
        );
      }

      // Generar nuevo token seguro y otorgar acceso directo
      const rawToken = await createPatientToken(appointment.id, 72);

      return NextResponse.json({
        success: true,
        directAccess: true,
        token: rawToken,
        publicCode: appointment.publicCode,
      });
    }

    // Caso B: Solo ingresó su correo electrónico
    // Por privacidad, buscamos sus turnos y le enviamos un correo con los enlaces de acceso
    const patient = await prisma.patient.findFirst({
      where: { email: normalizedEmail },
      include: {
        appointments: {
          where: {
            status: { notIn: ["CANCELADA", "COMPLETADA"] },
          },
          orderBy: { startTime: "desc" },
          take: 3,
        },
      },
    });

    if (patient && patient.appointments.length > 0) {
      // Generar token para su turno más próximo o activo
      const latestApp = patient.appointments[0];
      const rawToken = await createPatientToken(latestApp.id, 72);
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://turnos-psicologia.vercel.app")).replace(/\/+$/, "");

      EmailService.send({
        to: patient.email,
        subject: `Enlace de acceso a tus turnos - Consultorio Psicológico`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #2D3748; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
            <h2 style="color: #BE123C;">Acceso a tu turno</h2>
            <p>Hola <strong>${patient.fullName}</strong>,</p>
            <p>Recibimos tu solicitud para acceder a tu reserva para el día <strong>${formatDateTimeArgentina(latestApp.startTime)} hs</strong> (Código: ${latestApp.publicCode}).</p>
            <p style="text-align: center; margin: 28px 0;">
              <a href="${appUrl}/turno/${rawToken}" style="background-color: #E11D48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver mi turno</a>
            </p>
            <p style="font-size: 13px; color: #718096;">Si no solicitaste este enlace, podés desestimar este mensaje.</p>
          </div>
        `,
      }).catch((err) => console.error("Error al despachar email de recuperación:", err));
    }

    // Siempre devolvemos respuesta genérica de éxito para no enumerar emails
    return NextResponse.json({
      success: true,
      emailSent: true,
      message:
        "Si existe un turno asociado a este correo, te enviamos el enlace de acceso a tu casilla.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
