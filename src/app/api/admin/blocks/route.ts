import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { argentinaTimeToUtc } from "@/lib/timezone";
import { addMinutes } from "date-fns";

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
    const body = await req.json();
    const { dateStr, startTimeStr, endTimeStr, wholeDay, startTime, endTime, reason } = body;

    const finalReason = (reason || "").trim() || "Horario no laborable / Bloqueado";

    let startUtc: Date;
    let endUtc: Date;

    if (wholeDay && dateStr) {
      // Bloqueo de día completo: desde las 00:00:00 de Argentina hasta las 23:59:59 (00:00 del día siguiente)
      startUtc = argentinaTimeToUtc(dateStr, "00:00");
      endUtc = addMinutes(argentinaTimeToUtc(dateStr, "23:59"), 1);
    } else if (dateStr && startTimeStr && endTimeStr) {
      // Bloqueo por fecha y horarios locales de Argentina
      startUtc = argentinaTimeToUtc(dateStr, startTimeStr);
      endUtc = argentinaTimeToUtc(dateStr, endTimeStr);
    } else if (startTime && endTime) {
      // Compatibilidad con ISO string
      if (
        typeof startTime === "string" &&
        startTime.includes("T") &&
        !startTime.endsWith("Z") &&
        !startTime.includes("+") &&
        !startTime.includes("-", 10)
      ) {
        // String ISO local sin zona: ej "2026-10-30T09:00:00"
        const [d, t] = startTime.split("T");
        const [, tEnd] = endTime.split("T");
        startUtc = argentinaTimeToUtc(d, t.slice(0, 5));
        endUtc = argentinaTimeToUtc(d, tEnd.slice(0, 5));
      } else {
        startUtc = new Date(startTime);
        endUtc = new Date(endTime);
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Parámetros de fecha/horario insuficientes para crear el bloqueo." },
        { status: 400 }
      );
    }

    if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime()) || startUtc >= endUtc) {
      return NextResponse.json(
        { success: false, error: "Rango de horario inválido (el inicio debe ser anterior al fin)." },
        { status: 400 }
      );
    }

    // No permitir crear bloqueos en el pasado
    const now = new Date();
    if (endUtc <= now) {
      return NextResponse.json(
        { success: false, error: "No es posible crear bloqueos para horarios que ya han pasado." },
        { status: 400 }
      );
    }

    // Verificar si ya existe un bloqueo idéntico o que se superponga
    const existingBlock = await prisma.scheduleBlock.findFirst({
      where: {
        startTime: { lt: endUtc },
        endTime: { gt: startUtc },
      },
    });

    if (existingBlock) {
      return NextResponse.json(
        {
          success: false,
          error: "Ya existe un bloqueo que se superpone con este horario o el día ya se encuentra bloqueado.",
        },
        { status: 400 }
      );
    }

    // Verificar si ya existe una reserva activa o con comprobante pendiente de aprobación
    const conflictingApp = await prisma.appointment.findFirst({
      where: {
        startTime: { lt: endUtc },
        endTime: { gt: startUtc },
        status: { in: ["CONFIRMADA", "COMPROBANTE_ENVIADO"] },
      },
    });

    if (conflictingApp) {
      return NextResponse.json(
        {
          success: false,
          error: "No es posible bloquear este horario porque ya existe un turno reservado o con comprobante pendiente de aprobación.",
        },
        { status: 400 }
      );
    }

    const block = await prisma.scheduleBlock.create({
      data: {
        startTime: startUtc,
        endTime: endUtc,
        reason: finalReason,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "BLOCK_CREATED",
        entity: "ScheduleBlock",
        entityId: block.id,
        performedBy: `ADMIN:${admin.sub}`,
        details: JSON.stringify({ startUtc, endUtc, reason: finalReason }),
      },
    });

    return NextResponse.json({ success: true, block });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Error al crear bloqueo" },
      { status: 500 }
    );
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
