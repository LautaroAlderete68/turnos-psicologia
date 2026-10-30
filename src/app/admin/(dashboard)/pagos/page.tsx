import prisma from "@/lib/prisma";
import AdminPaymentsClient from "./payments-client";

import { AppointmentService } from "@/lib/services/appointment.service";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  try {
    await AppointmentService.cleanExpiredAppointments();
  } catch (e) {
    console.error("Error al limpiar reservas expiradas:", e);
  }
  const payments = await prisma.payment.findMany({
    include: {
      appointment: {
        include: {
          patient: true,
        },
      },
      proofs: {
        orderBy: { uploadedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminPaymentsClient
      payments={JSON.parse(JSON.stringify(payments))}
    />
  );
}
