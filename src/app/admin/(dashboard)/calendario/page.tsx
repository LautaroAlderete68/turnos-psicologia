import prisma from "@/lib/prisma";
import AdminCalendarClient from "./calendar-client";
import { startOfWeek, endOfWeek, addWeeks, subWeeks, addDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const profile = await prisma.psychologistProfile.findFirst();

  // Traer turnos de los próximos 30 días y pasados 7 días
  const now = new Date();
  const rangeStart = subWeeks(now, 1);
  const rangeEnd = addWeeks(now, 4);

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      patient: true,
      payment: true,
    },
    orderBy: { startTime: "asc" },
  });

  const blocks = await prisma.scheduleBlock.findMany({
    where: {
      startTime: { gte: rangeStart, lte: rangeEnd },
    },
    orderBy: { startTime: "asc" },
  });

  const weeklySchedules = await prisma.weeklySchedule.findMany({
    orderBy: { dayOfWeek: "asc" },
  });

  return (
    <AdminCalendarClient
      appointments={JSON.parse(JSON.stringify(appointments))}
      blocks={JSON.parse(JSON.stringify(blocks))}
      weeklySchedules={JSON.parse(JSON.stringify(weeklySchedules))}
      profile={JSON.parse(JSON.stringify(profile || {}))}
    />
  );
}
