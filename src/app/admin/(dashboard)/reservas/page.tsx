import prisma from "@/lib/prisma";
import AdminReservationsClient from "./reservations-client";

export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  const appointments = await prisma.appointment.findMany({
    include: {
      patient: true,
      payment: {
        include: {
          proofs: true,
        },
      },
    },
    orderBy: { startTime: "desc" },
    take: 100,
  });

  return (
    <AdminReservationsClient
      appointments={JSON.parse(JSON.stringify(appointments))}
    />
  );
}
