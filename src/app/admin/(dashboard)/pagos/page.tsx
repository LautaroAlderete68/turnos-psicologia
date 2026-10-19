import prisma from "@/lib/prisma";
import AdminPaymentsClient from "./payments-client";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
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
