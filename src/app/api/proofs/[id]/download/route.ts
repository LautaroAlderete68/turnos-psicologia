import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { PaymentService } from "@/lib/services/payment.service";
import { storageProvider } from "@/lib/services/storage.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proofId } = await params;
    const { searchParams } = new URL(req.url);
    const patientToken = searchParams.get("token") || undefined;

    // Verificar si es administrador
    const adminSession = await getAdminSession();
    const isAdmin = !!adminSession;

    // Comprobar autorización de acceso
    const hasAccess = await PaymentService.canAccessProof(proofId, {
      isAdmin,
      patientToken,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Acceso no autorizado al comprobante." },
        { status: 403 }
      );
    }

    const proof = await prisma.paymentProof.findUnique({
      where: { id: proofId },
    });

    if (!proof) {
      return NextResponse.json(
        { success: false, error: "Comprobante no encontrado." },
        { status: 404 }
      );
    }

    const fileBuffer = await storageProvider.get(proof.storageKey);
    if (!fileBuffer) {
      return NextResponse.json(
        { success: false, error: "Archivo físico no encontrado en almacenamiento." },
        { status: 404 }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", proof.mimeType);
    headers.set("Content-Length", proof.sizeBytes.toString());
    headers.set("Content-Disposition", `inline; filename="${proof.originalFilename}"`);
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("Error en descarga de comprobante:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener el comprobante" },
      { status: 500 }
    );
  }
}
