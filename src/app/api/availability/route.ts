import { NextRequest, NextResponse } from "next/server";
import { AvailabilityService } from "@/lib/services/availability.service";
import prisma from "@/lib/prisma";
import { SESSION_DURATION_MINUTES, SESSION_PRICE } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const datesParam = searchParams.get("dates");

    // También retornar datos básicos del perfil profesional (honorario, duración, modalidades)
    const profile = await prisma.psychologistProfile.findFirst({
      select: {
        sessionDuration: true,
        allowPresencial: true,
        allowVirtual: true,
        fullName: true,
        specialty: true,
      },
    });

    if (datesParam) {
      const dates = datesParam.split(",").map((d) => d.trim());
      const data = await AvailabilityService.getSlotsForRange(dates);
      return NextResponse.json({
        success: true,
        profile: profile
          ? { ...profile, sessionPrice: SESSION_PRICE, sessionDuration: SESSION_DURATION_MINUTES }
          : profile,
        days: data,
      });
    }

    if (!dateStr) {
      return NextResponse.json(
        { success: false, error: "Parámetro 'date' o 'dates' requerido" },
        { status: 400 }
      );
    }

    const data = await AvailabilityService.getSlotsForDate(dateStr);
    return NextResponse.json({
      success: true,
      profile: profile
        ? { ...profile, sessionPrice: SESSION_PRICE, sessionDuration: SESSION_DURATION_MINUTES }
        : profile,
      day: data,
    });
  } catch (error: any) {
    console.error("Error en /api/availability:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al consultar disponibilidad" },
      { status: 500 }
    );
  }
}
