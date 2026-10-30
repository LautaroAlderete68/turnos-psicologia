import prisma from "@/lib/prisma";
import AdminReservationsClient from "./reservations-client";

import { AppointmentService } from "@/lib/services/appointment.service";

export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  try {
    await AppointmentService.cleanExpiredAppointments();
  } catch (e) {
    console.error("Error al limpiar reservas expiradas:", e);
  }
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
