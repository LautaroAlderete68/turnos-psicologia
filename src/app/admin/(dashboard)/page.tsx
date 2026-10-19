import Link from "next/link";
import {
  Calendar,
  Clock,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import prisma from "@/lib/prisma";
import {
  formatDateTimeArgentina,
  formatTime24h,
  argentinaTimeToUtc,
  getArgentinaDateString,
  toArgentinaZoned,
} from "@/lib/timezone";
import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminDashboardOverviewPage() {
  const now = new Date();
  const todayDateStr = getArgentinaDateString(now);

  const todayStartUtc = argentinaTimeToUtc(todayDateStr, "00:00");
  const todayEndUtc = argentinaTimeToUtc(todayDateStr, "23:59");

  // 1. Métricas clave
  const todayAppointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: todayStartUtc, lte: todayEndUtc },
    },
    include: { patient: true, payment: true },
    orderBy: { startTime: "asc" },
  });

  const pendingProofsCount = await prisma.payment.count({
    where: { status: "COMPROBANTE_RECIBIDO" },
  });

  const pendingBookingsCount = await prisma.appointment.count({
    where: { status: "PENDIENTE_PAGO" },
  });

  const cancelledCount = await prisma.appointment.count({
    where: { status: "CANCELADA" },
  });

  // Próximos turnos de los siguientes 7 días
  const nextWeekEndUtc = addDays(todayEndUtc, 7);
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      startTime: { gt: todayEndUtc, lte: nextWeekEndUtc },
      status: { notIn: ["CANCELADA"] },
    },
    include: { patient: true, payment: true },
    orderBy: { startTime: "asc" },
    take: 8,
  });

  // Comprobantes pendientes de revisión
  const pendingProofsList = await prisma.paymentProof.findMany({
    where: {
      payment: { status: "COMPROBANTE_RECIBIDO" },
    },
    include: {
      payment: {
        include: {
          appointment: {
            include: { patient: true },
          },
        },
      },
    },
    orderBy: { uploadedAt: "desc" },
    take: 5,
  });

  // Ingresos del mes (pagos aprobados)
  const monthStartUtc = startOfMonth(now);
  const monthEndUtc = endOfMonth(now);
  const approvedPaymentsThisMonth = await prisma.payment.aggregate({
    where: {
      status: "APROBADO",
      reviewedAt: { gte: monthStartUtc, lte: monthEndUtc },
    },
    _sum: { amount: true },
    _count: true,
  });

  const totalRevenue = approvedPaymentsThisMonth._sum.amount || 0;
  const approvedCount = approvedPaymentsThisMonth._count || 0;

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Resumen General
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Estado actual de la agenda, pacientes y comprobantes pendientes de validación.
        </p>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Turnos de hoy */}
        <div className="rounded-2xl border border-warm-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Turnos de Hoy
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-100 text-sage-800">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{todayAppointments.length}</p>
          <span className="mt-1 block text-xs text-gray-400">
            {todayAppointments.filter((a) => a.status === "CONFIRMADA").length} confirmados
          </span>
        </div>

        {/* Comprobantes por revisar */}
        <div className="rounded-2xl border border-warm-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Comprobantes Pendientes
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-blue-900">{pendingProofsCount}</p>
          <Link
            href="/admin/pagos"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            <span>Revisar bandeja</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Reservas pendientes de pago */}
        <div className="rounded-2xl border border-warm-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Reservas Pendientes
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-900">{pendingBookingsCount}</p>
          <span className="mt-1 block text-xs text-gray-400">En espera de transferencia</span>
        </div>

        {/* Ingresos confirmados del mes */}
        <div className="rounded-2xl border border-warm-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Cobranzas del Mes
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-800">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-green-900 sm:text-3xl">
            ${totalRevenue.toLocaleString("es-AR")}
          </p>
          <span className="mt-1 block text-xs text-gray-400">
            {approvedCount} sesiones aprobadas
          </span>
        </div>
      </div>

      {/* Grilla: Turnos de Hoy y Comprobantes por Validar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Turnos de Hoy */}
        <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-warm-200 pb-4">
            <h2 className="text-base font-bold text-gray-900">Agenda de Hoy ({todayDateStr})</h2>
            <Link
              href="/admin/calendario"
              className="text-xs font-semibold text-sage-700 hover:text-sage-900"
            >
              Ver calendario completo →
            </Link>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No tenés turnos programados para el día de hoy.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {todayAppointments.map((app) => (
                <div key={app.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-semibold text-gray-900 block text-sm">
                      {app.patient.fullName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {app.modality === "PRESENCIAL" ? "Presencial" : "Virtual"} • Tel:{" "}
                      {app.patient.phone}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-sage-900 block">
                      {formatTime24h(app.startTime)} hs
                    </span>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        app.status === "CONFIRMADA"
                          ? "bg-green-100 text-green-800"
                          : app.status === "COMPROBANTE_ENVIADO"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comprobantes Pendientes de Aprobación */}
        <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-warm-200 pb-4">
            <h2 className="text-base font-bold text-gray-900">
              Comprobantes para Revisar ({pendingProofsList.length})
            </h2>
            <Link
              href="/admin/pagos"
              className="text-xs font-semibold text-sage-700 hover:text-sage-900"
            >
              Ir a Pagos →
            </Link>
          </div>

          {pendingProofsList.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No hay comprobantes pendientes de validación. ¡Estás al día!
            </div>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {pendingProofsList.map((proof) => (
                <div key={proof.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-semibold text-gray-900 block text-sm">
                      {proof.payment.appointment.patient.fullName}
                    </span>
                    <span className="text-xs text-gray-500">
                      Turno: {proof.payment.appointment.publicCode} • Importe: $
                      {proof.payment.amount.toLocaleString("es-AR")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/proofs/${proof.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Ver
                    </a>
                    <Link
                      href="/admin/pagos"
                      className="rounded-lg bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sage-700"
                    >
                      Revisar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Próximos Turnos de la Semana */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
        <h2 className="text-base font-bold text-gray-900 border-b border-warm-200 pb-4">
          Próximos Turnos Programados
        </h2>

        {upcomingAppointments.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            No hay turnos agendados para los próximos días.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-warm-50 text-gray-600">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">Modalidad</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {upcomingAppointments.map((app) => (
                  <tr key={app.id} className="hover:bg-warm-50/50">
                    <td className="p-3 font-mono font-bold text-gray-700">{app.publicCode}</td>
                    <td className="p-3 font-medium text-gray-900">{app.patient.fullName}</td>
                    <td className="p-3 text-gray-700">
                      {formatDateTimeArgentina(app.startTime)} hs
                    </td>
                    <td className="p-3 text-gray-600">
                      {app.modality === "PRESENCIAL" ? "Presencial" : "Virtual"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          app.status === "CONFIRMADA"
                            ? "bg-green-100 text-green-800"
                            : app.status === "COMPROBANTE_ENVIADO"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/reservas?search=${app.publicCode}`}
                        className="text-xs font-semibold text-sage-700 hover:underline"
                      >
                        Detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
