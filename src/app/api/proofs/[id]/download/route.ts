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

    const etag = `"${proof.id}-${proof.sizeBytes}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "private, max-age=86400, stale-while-revalidate=3600",
          ETag: etag,
        },
      });
    }

    const fileBuffer = proof.dataBuffer || (await storageProvider.get(proof.storageKey));
    if (!fileBuffer) {
      return NextResponse.json(
        { success: false, error: "Archivo físico no encontrado en almacenamiento." },
        { status: 404 }
      );
    }

    const headers = new Headers();
    const isPdf = proof.mimeType === "application/pdf" || proof.originalFilename.toLowerCase().endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" : proof.mimeType;
    const safeFilename = proof.originalFilename.replace(/["\r\n]/g, "");

    headers.set("Content-Type", mimeType);
    headers.set("Content-Length", (fileBuffer.byteLength || (fileBuffer as any).length || proof.sizeBytes).toString());
    headers.set("Content-Disposition", `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    headers.set("Cache-Control", "private, max-age=86400, stale-while-revalidate=3600");
    headers.set("ETag", etag);
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Content-Security-Policy", "frame-ancestors 'self'");

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
