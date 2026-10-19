import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminSession();
    const blocks = await prisma.scheduleBlock.findMany({
      orderBy: { startTime: "asc" },
    });
    return NextResponse.json({ success: true, blocks });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error al listar bloqueos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    const { startTime, endTime, reason } = await req.json();

    if (!startTime || !endTime || !reason) {
      return NextResponse.json(
        { success: false, error: "Se requiere startTime, endTime y motivo del bloqueo." },
        { status: 400 }
      );
    }

    const block = await prisma.scheduleBlock.create({
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        reason: reason.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "BLOCK_CREATED",
        entity: "ScheduleBlock",
        entityId: block.id,
        performedBy: `ADMIN:${admin.sub}`,
        details: JSON.stringify({ startTime, endTime, reason }),
      },
    });

    return NextResponse.json({ success: true, block });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || "Error al crear bloqueo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
    }

    await prisma.scheduleBlock.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "BLOCK_DELETED",
        entity: "ScheduleBlock",
        entityId: id,
        performedBy: `ADMIN:${admin.sub}`,
      },
    });

    return NextResponse.json({ success: true, message: "Bloqueo eliminado" });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error al eliminar bloqueo" }, { status: 500 });
  }
}
