"use client";

import React, { useState, useMemo } from "react";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Eye,
  X,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { formatDateTimeArgentina, getArgentinaDateString } from "@/lib/timezone";

interface AdminPaymentsClientProps {
  payments: any[];
}

export default function AdminPaymentsClient({
  payments: initialPayments,
}: AdminPaymentsClientProps) {
  const [payments, setPayments] = useState(initialPayments);

  // Modal para rechazo con motivo
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal para vista previa segura del comprobante
  const [previewProof, setPreviewProof] = useState<any | null>(null);

  // Filtro de historial
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [hidePast, setHidePast] = useState(true);
  const todayStr = useMemo(() => getArgentinaDateString(new Date()), []);

  const pendingPayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.status !== "COMPROBANTE_RECIBIDO") return false;
      if (hidePast && getArgentinaDateString(p.appointment.startTime) < todayStr) return false;
      return true;
    });
  }, [payments, hidePast, todayStr]);

  const filteredHistory = useMemo(() => {
    return payments.filter((p) => {
      if (filterStatus !== "TODOS" && p.status !== filterStatus) return false;
      if (hidePast && getArgentinaDateString(p.appointment.startTime) < todayStr) return false;
      return true;
    });
  }, [payments, filterStatus, hidePast, todayStr]);

  const handleApprove = async (paymentId: string) => {
    if (!confirm("¿Aprobar el pago y confirmar definitivamente el turno del paciente?")) return;

    setProcessingId(paymentId);
    try {
      const res = await fetch("/api/admin/payments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId
              ? {
                  ...p,
                  status: "APROBADO",
                  reviewedAt: new Date().toISOString(),
                  rejectionReason: null,
                  appointment: {
                    ...p.appointment,
                    status: "CONFIRMADA",
                  },
                }
              : p
          )
        );
      } else {
        alert(data.error || "No se pudo aprobar el pago.");
      }
    } catch {
      alert("Error al comunicarse con el servidor.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPaymentId || !rejectionReason.trim()) {
      alert("Por favor indicá el motivo del rechazo.");
      return;
    }

    setProcessingId(rejectingPaymentId);
    try {
      const res = await fetch("/api/admin/payments/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: rejectingPaymentId,
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPayments((prev) =>
          prev.map((p) =>
            p.id === rejectingPaymentId
              ? {
                  ...p,
                  status: "RECHAZADO",
                  reviewedAt: new Date().toISOString(),
                  rejectionReason: rejectionReason.trim(),
                  appointment: {
                    ...p.appointment,
                    status: "PENDIENTE_PAGO",
                  },
                }
              : p
          )
        );
        setRejectingPaymentId(null);
        setRejectionReason("");
      } else {
        alert(data.error || "No se pudo rechazar el pago.");
      }
    } catch {
      alert("Error al comunicarse con el servidor.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Validación de Comprobantes y Pagos
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Revisá las transferencias adjuntas por los pacientes, aprobá o rechazá con motivo.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none shadow-2xs shrink-0 self-start sm:self-auto">
          <input
            type="checkbox"
            checked={hidePast}
            onChange={(e) => setHidePast(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 accent-rose-600"
          />
          <span>Ocultar fechas pasadas</span>
        </label>
      </div>

      {/* BANDEJA: Comprobantes Pendientes de Revisión */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-warm-200 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-800 font-bold text-xs">
              {pendingPayments.length}
            </span>
            <h2 className="text-base font-bold text-gray-900">
              Comprobantes Pendientes de Validación
            </h2>
          </div>
          <span className="text-xs text-gray-500">
            Requieren revisión manual de la psicóloga
          </span>
        </div>

        {pendingPayments.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No hay comprobantes pendientes en este momento.{hidePast && (
              <span className="block mt-1 text-xs text-gray-500">
                (Las fechas pasadas están ocultas. Desmarcá el filtro &quot;Ocultar fechas pasadas&quot; para visualizarlas).
              </span>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {pendingPayments.map((payment) => {
              const latestProof = payment.proofs[0];
              const isProcessing = processingId === payment.id;

              return (
                <div
                  key={payment.id}
                  className="rounded-xl border border-gray-200 bg-warm-50/40 p-4 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-gray-500">
                        {payment.appointment.publicCode}
                      </span>
                      <span className="text-sm font-extrabold text-sage-900">
                        ${payment.amount.toLocaleString("es-AR")}
                      </span>
                    </div>

                    <h3 className="mt-1 text-base font-bold text-gray-900">
                      {payment.appointment.patient.fullName}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Turno: {formatDateTimeArgentina(payment.appointment.startTime)} hs (
                      {payment.appointment.modality === "PRESENCIAL" ? "Presencial" : "Virtual"})
                    </p>

                    {latestProof && (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-white p-2 text-xs border border-gray-200">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-sage-600 shrink-0" />
                          <span className="truncate">{latestProof.originalFilename}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewProof(latestProof)}
                          className="flex items-center gap-1 font-semibold text-sage-700 hover:text-sage-900 shrink-0 ml-2"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Previsualizar</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Botones de Aprobación y Rechazo */}
                  <div className="mt-5 flex items-center gap-2 border-t border-gray-200/80 pt-3">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApprove(payment.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:bg-gray-400"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Aprobar Pago</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setRejectingPaymentId(payment.id);
                        setRejectionReason("");
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:bg-gray-100"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Rechazar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial Completo de Pagos */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-warm-200 pb-4">
          <h2 className="text-base font-bold text-gray-900">Historial de Cobros</h2>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 select-none shadow-2xs">
              <input
                type="checkbox"
                checked={hidePast}
                onChange={(e) => setHidePast(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-rose-600 focus:ring-rose-500 accent-rose-600"
              />
              <span>Ocultar fechas pasadas</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Filtrar estado:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-sage-600 focus:outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="APROBADO">Aprobados</option>
              <option value="RECHAZADO">Rechazados</option>
              <option value="COMPROBANTE_RECIBIDO">En revisión</option>
              <option value="PENDIENTE">Pendientes</option>
            </select>
          </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-warm-50 text-gray-600 font-semibold border-b border-warm-200">
              <tr>
                <th className="p-3">Turno</th>
                <th className="p-3">Paciente</th>
                <th className="p-3">Importe</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Revisión</th>
                <th className="p-3">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No hay registros de cobros con los filtros aplicados.
                    {hidePast && (
                      <span className="block mt-1 text-xs text-gray-500">
                        (Las fechas pasadas están ocultas. Desmarcá el filtro &quot;Ocultar fechas pasadas&quot; para visualizarlas).
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((p) => {
                const proof = p.proofs[0];
                return (
                  <tr key={p.id} className="hover:bg-warm-50/50">
                    <td className="p-3 font-mono font-bold text-gray-700">
                      {p.appointment.publicCode}
                    </td>
                    <td className="p-3 font-medium text-gray-900">
                      {p.appointment.patient.fullName}
                    </td>
                    <td className="p-3 font-semibold text-gray-800">
                      ${p.amount.toLocaleString("es-AR")}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          p.status === "APROBADO"
                            ? "bg-rose-100 text-rose-800"
                            : p.status === "COMPROBANTE_RECIBIDO"
                            ? "bg-rose-50 text-rose-700"
                            : p.status === "RECHAZADO"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500 text-xs">
                      {p.reviewedAt ? (
                        <span>{formatDateTimeArgentina(p.reviewedAt)} hs</span>
                      ) : (
                        <span className="text-gray-400">Sin revisar</span>
                      )}
                      {p.rejectionReason && (
                        <span className="block text-[11px] text-red-600 font-medium mt-0.5">
                          Motivo: {p.rejectionReason}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {proof ? (
                        <button
                          type="button"
                          onClick={() => setPreviewProof(proof)}
                          className="text-sage-700 hover:text-sage-900 font-semibold text-xs flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ver</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No adjuntó</span>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Rechazar Comprobante */}
      {rejectingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-gray-900 text-lg">Rechazar Comprobante</h3>
            <p className="mt-1 text-xs text-gray-500">
              Indicá el motivo del rechazo. El paciente recibirá esta notificación para poder subir
              un comprobante correcto.
            </p>

            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Motivo de Rechazo *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ej: Importe transferido incorrecto, comprobante ilegible, número de operación duplicado..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingPaymentId(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectingPaymentId}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vista Previa Segura del Comprobante */}
      {previewProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  {previewProof.originalFilename}
                </h3>
                <span className="text-xs text-gray-500">
                  Subido: {formatDateTimeArgentina(previewProof.uploadedAt)} hs • Tipo:{" "}
                  {previewProof.mimeType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/proofs/${previewProof.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Abrir original</span>
                </a>
                <button
                  onClick={() => setPreviewProof(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Visor */}
            <div className="mt-4 flex-1 overflow-auto rounded-xl bg-gray-100 p-2 flex items-center justify-center min-h-[300px]">
              {previewProof.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/proofs/${previewProof.id}/download`}
                  alt="Comprobante"
                  className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-sm"
                />
              ) : (
                <div className="w-full h-[65vh] flex flex-col">
                  <object
                    data={`/api/proofs/${previewProof.id}/download`}
                    type="application/pdf"
                    className="h-full w-full rounded-lg border-0 shadow-xs"
                  >
                    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-gray-500 bg-white rounded-lg">
                      <p className="mb-2 text-sm font-medium text-gray-700">Comprobante en formato PDF</p>
                      <p className="mb-4 text-xs text-gray-500">Podés previsualizar o descargar el archivo completo directamente:</p>
                      <a
                        href={`/api/proofs/${previewProof.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sage-700 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Abrir o descargar PDF</span>
                      </a>
                    </div>
                  </object>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cerrar vista previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
