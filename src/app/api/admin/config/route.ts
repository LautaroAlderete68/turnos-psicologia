import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminSession();
    const profile = await prisma.psychologistProfile.findFirst();
    const weeklySchedules = await prisma.weeklySchedule.findMany({
      orderBy: { dayOfWeek: "asc" },
    });
    const exceptions = await prisma.scheduleException.findMany({
      orderBy: { dateString: "asc" },
    });

    return NextResponse.json({
      success: true,
      profile,
      weeklySchedules,
      exceptions,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error al cargar configuración" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    const body = await req.json();

    const { profileData, weeklySchedules, exceptions } = body;

    if (profileData) {
      const existingProfile = await prisma.psychologistProfile.findFirst();
      if (existingProfile) {
        await prisma.psychologistProfile.update({
          where: { id: existingProfile.id },
          data: {
            fullName: profileData.fullName,
            license: profileData.license,
            specialty: profileData.specialty,
            bio: profileData.bio,
            phone: profileData.phone,
            email: profileData.email,
            address: profileData.address,
            allowPresencial: profileData.allowPresencial,
            allowVirtual: profileData.allowVirtual,
            googleMeetUrl: profileData.googleMeetUrl,
            sessionPrice: Number(profileData.sessionPrice),
            sessionDuration: Number(profileData.sessionDuration),
            bufferMinutes: Number(profileData.bufferMinutes),
            minNoticeMinutes: profileData.minNoticeMinutes !== undefined ? Number(profileData.minNoticeMinutes) : (profileData.minNoticeHours ? Number(profileData.minNoticeHours) * 60 : 30),
            minNoticeHours: profileData.minNoticeMinutes !== undefined ? Math.ceil(Number(profileData.minNoticeMinutes) / 60) : Number(profileData.minNoticeHours || 1),
            maxAdvanceDays: Number(profileData.maxAdvanceDays),
            pendingExpirationMinutes: Number(profileData.pendingExpirationMinutes),
            bankAccountHolder: profileData.bankAccountHolder,
            bankName: profileData.bankName,
            bankCbu: profileData.bankCbu,
            bankAlias: profileData.bankAlias,
            paymentInstructions: profileData.paymentInstructions,
            cancellationPolicy: profileData.cancellationPolicy,
            privacyNotice: profileData.privacyNotice,
          },
        });
      }
    }

    if (Array.isArray(weeklySchedules)) {
      for (const schedule of weeklySchedules) {
        await prisma.weeklySchedule.upsert({
          where: { dayOfWeek: schedule.dayOfWeek },
          update: {
            isActive: schedule.isActive,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            breakStartTime: schedule.breakStartTime || null,
            breakEndTime: schedule.breakEndTime || null,
          },
          create: {
            dayOfWeek: schedule.dayOfWeek,
            isActive: schedule.isActive,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            breakStartTime: schedule.breakStartTime || null,
            breakEndTime: schedule.breakEndTime || null,
          },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        action: "CONFIG_UPDATED",
        entity: "PsychologistProfile",
        performedBy: `ADMIN:${admin.sub}`,
      },
    });

    return NextResponse.json({ success: true, message: "Configuración actualizada con éxito" });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || "Error al actualizar configuración" }, { status: 500 });
  }
}
