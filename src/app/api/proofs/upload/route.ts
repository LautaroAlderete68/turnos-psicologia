import { NextRequest, NextResponse } from "next/server";
import { validatePatientToken } from "@/lib/patient-auth";
import { PaymentService } from "@/lib/services/payment.service";
import { checkRateLimit } from "@/lib/rate-limit";
import { EmailService } from "@/lib/services/email.service";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimit = checkRateLimit(`upload:${ip}`, 20, 60 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Límite de subidas alcanzado. Esperá unos minutos." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const appointmentId = formData.get("appointmentId") as string;
    const patientToken = (formData.get("patientToken") || formData.get("token")) as string;
    const file = formData.get("file") as File | null;

    if (!appointmentId || !patientToken || !file) {
      return NextResponse.json(
        { success: false, error: "Datos incompletos. Se requiere turno, token de acceso y archivo." },
        { status: 400 }
      );
    }

    // 1. Validar autorización del paciente mediante su token criptográfico
    const appointment = await validatePatientToken(patientToken);
    if (!appointment || appointment.id !== appointmentId) {
      return NextResponse.json(
        { success: false, error: "No tenés autorización para adjuntar comprobantes a este turno." },
        { status: 401 }
      );
    }

    // 2. Extraer buffer del archivo y sanitizar nombre
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // 3. Adjuntar comprobante y validar magic bytes
    const result = await PaymentService.attachProof({
      appointmentId,
      buffer,
      originalFilename,
    });

    // 4. Notificar recepción del comprobante
    EmailService.sendProofReceived({
      to: appointment.patient.email,
      patientName: appointment.patient.fullName,
      publicCode: appointment.publicCode,
    }).catch((err) => console.error("Error al despachar email de comprobante recibido:", err));

    return NextResponse.json({
      success: true,
      data: {
        proofId: result.proofId,
        mimeType: result.mimeType,
        uploadedAt: result.uploadedAt,
      },
    });
  } catch (error: any) {
    console.error("Error al subir comprobante:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar el archivo" },
      { status: 400 }
    );
  }
}
