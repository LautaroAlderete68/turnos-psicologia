import prisma from "@/lib/prisma";
import AdminConfigClient from "./config-client";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const profile = await prisma.psychologistProfile.findFirst();
  const weeklySchedules = await prisma.weeklySchedule.findMany({
    orderBy: { dayOfWeek: "asc" },
  });
  const exceptions = await prisma.scheduleException.findMany({
    orderBy: { dateString: "asc" },
  });

  return (
    <AdminConfigClient
      profile={JSON.parse(JSON.stringify(profile || {}))}
      weeklySchedules={JSON.parse(JSON.stringify(weeklySchedules))}
      exceptions={JSON.parse(JSON.stringify(exceptions))}
    />
  );
}
