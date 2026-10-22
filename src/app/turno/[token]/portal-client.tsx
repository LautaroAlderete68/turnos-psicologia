"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  CreditCard,
  UploadCloud,
  FileCheck,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  XCircle,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { formatDateTimeArgentina } from "@/lib/timezone";

interface PortalClientProps {
  appointment: any;
  token: string;
  profile: any;
}

export default function PatientPortalClient({
  appointment: initialApp,
  token,
  profile,
}: PortalClientProps) {
  const [appointment, setAppointment] = useState(initialApp);
  const [copiedCbu, setCopiedCbu] = useState(false);
  const [copiedAlias, setCopiedAlias] = useState(false);

  // Estado del uploader
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Cancelación
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Contador de expiración
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (appointment.status !== "PENDIENTE_PAGO" || !appointment.expiresAt) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const exp = new Date(appointment.expiresAt).getTime();
      const diff = exp - now;

      if (diff <= 0) {
        setTimeLeft("Expirada");
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours > 0 ? hours + "h " : ""}${minutes}m ${String(seconds).padStart(2, "0")}s`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [appointment.status, appointment.expiresAt]);

  const copyToClipboard = async (text: string, type: "cbu" | "alias") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "cbu") {
        setCopiedCbu(true);
        setTimeout(() => setCopiedCbu(false), 2000);
      } else {
        setCopiedAlias(true);
        setTimeout(() => setCopiedAlias(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("appointmentId", appointment.id);
      formData.append("patientToken", token);
      formData.append("file", file);

      const res = await fetch("/api/proofs/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error || "No se pudo subir el comprobante.");
        return;
      }

      setUploadSuccess(true);
      setFile(null);

      // Actualizar estado local
      setAppointment((prev: any) => ({
        ...prev,
        status: "COMPROBANTE_ENVIADO",
        payment: {
          ...prev.payment,
          status: "COMPROBANTE_RECIBIDO",
          proofs: [
            {
              id: data.data.proofId,
              mimeType: data.data.mimeType,
              uploadedAt: data.data.uploadedAt,
              originalFilename: file.name,
            },
            ...(prev.payment?.proofs || []),
          ],
        },
      }));
    } catch {
      setUploadError("Error de conexión al cargar el archivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancelReason.trim()) {
      alert("Por favor indicá un motivo de cancelación.");
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch("/api/admin/appointments/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          status: "CANCELADA",
          cancellationReason: cancelReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAppointment((prev: any) => ({
          ...prev,
          status: "CANCELADA",
          cancellationReason: cancelReason.trim(),
        }));
        setShowCancelModal(false);
      } else {
        alert(data.error || "No se pudo cancelar el turno.");
      }
    } catch {
      alert("Error al intentar cancelar.");
    } finally {
      setCancelling(false);
    }
  };

  // Badges visuales
  const getReservationBadge = (status: string) => {
    switch (status) {
      case "CONFIRMADA":
        return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">Turno Confirmado</span>;
      case "COMPROBANTE_ENVIADO":
        return <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Comprobante en Revisión</span>;
      case "PENDIENTE_PAGO":
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pendiente de Pago</span>;
      case "CANCELADA":
        return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">Cancelado</span>;
      case "COMPLETADA":
        return <span className="rounded-full bg-rose-200 px-3 py-1 text-xs font-semibold text-rose-900">Completado</span>;
      case "AUSENTE":
        return <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">Ausente</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">{status}</span>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "APROBADO":
        return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">Pago Aprobado</span>;
      case "COMPROBANTE_RECIBIDO":
        return <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Comprobante Recibido</span>;
      case "PENDIENTE":
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Pago Pendiente</span>;
      case "RECHAZADO":
        return <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">Pago Rechazado</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Encabezado del turno */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-gray-500 uppercase tracking-wider">
                {appointment.publicCode}
              </span>
              <span>•</span>
              <span className="text-xs text-gray-500">
                Titular: {appointment.patient.fullName}
              </span>
            </div>

            <h1 className="mt-1 text-2xl font-extrabold text-sage-950 sm:text-3xl">
              Detalle de tu Turno
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div>
              <span className="text-[10px] text-gray-400 block mb-0.5">Estado Reserva:</span>
              {getReservationBadge(appointment.status)}
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block mb-0.5">Estado Pago:</span>
              {getPaymentBadge(appointment.payment?.status || "PENDIENTE")}
            </div>
          </div>
        </div>

        {/* Alerta de tiempo de expiración si está pendiente de pago */}
        {appointment.status === "PENDIENTE_PAGO" && timeLeft && (
          <div className="mt-6 flex items-center justify-between rounded-xl bg-amber-50 p-4 border border-amber-200 text-amber-900">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <span>Tiempo para abonar y adjuntar comprobante antes de liberar el horario:</span>
            </div>
            <span className="font-mono font-bold text-amber-800">{timeLeft}</span>
          </div>
        )}

        {/* Alerta de comprobante rechazado si aplica */}
        {appointment.payment?.status === "RECHAZADO" && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 border border-red-200 text-red-900 text-sm">
            <p className="font-bold">Observación de la profesional:</p>
            <p className="mt-1">{appointment.payment.rejectionReason || "Comprobante rechazado."}</p>
            <p className="mt-2 text-xs text-red-700">
              Por favor revisá los datos y subí un nuevo comprobante legible a continuación.
            </p>
          </div>
        )}

        {/* Grilla de detalles */}
        <div className="mt-6 grid gap-4 rounded-xl bg-warm-50 p-4 sm:grid-cols-3 sm:p-5 text-xs sm:text-sm">
          <div>
            <span className="text-gray-500 block mb-1">Fecha y Horario:</span>
            <div className="flex items-center gap-1.5 font-semibold text-gray-900">
              <Calendar className="h-4 w-4 text-sage-600" />
              <span>{formatDateTimeArgentina(appointment.startTime)} hs</span>
            </div>
          </div>

          <div>
            <span className="text-gray-500 block mb-1">Modalidad:</span>
            <div className="flex items-center gap-1.5 font-semibold text-gray-900">
              {appointment.modality === "PRESENCIAL" ? (
                <>
                  <MapPin className="h-4 w-4 text-sage-600" />
                  <span>Presencial en consultorio</span>
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 text-sage-600" />
                  <span>Atención Virtual (videollamada)</span>
                </>
              )}
            </div>
          </div>

          <div>
            <span className="text-gray-500 block mb-1">Honorario de sesión:</span>
            <div className="flex items-center gap-1.5 font-bold text-sage-900 text-base">
              <span>${appointment.price.toLocaleString("es-AR")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECCIÓN DE PAGO Y SUBIDA DE COMPROBANTES */}
      {/* ===================================================================== */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Datos Bancarios para transferir */}
        <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 text-sage-800">
            <CreditCard className="h-5 w-5" />
            <h2 className="font-bold text-gray-900">Datos para Transferir</h2>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            {profile.paymentInstructions || "Transferí el importe exacto para confirmar tu turno."}
          </p>

          <div className="mt-4 space-y-3 rounded-xl bg-warm-50 p-4 text-xs sm:text-sm">
            <div>
              <span className="text-gray-500 block text-[11px]">Banco:</span>
              <span className="font-semibold text-gray-900">{profile.bankName}</span>
            </div>

            <div>
              <span className="text-gray-500 block text-[11px]">Titular:</span>
              <span className="font-semibold text-gray-900">{profile.bankAccountHolder}</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-[11px]">Alias:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(profile.bankAlias, "alias")}
                  className="flex items-center gap-1 text-[11px] font-semibold text-sage-700 hover:text-sage-900"
                >
                  {copiedAlias ? <Check className="h-3 w-3 text-rose-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedAlias ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
              <span className="font-mono font-bold text-sage-950 block">{profile.bankAlias}</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-[11px]">CBU / CVU:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(profile.bankCbu, "cbu")}
                  className="flex items-center gap-1 text-[11px] font-semibold text-sage-700 hover:text-sage-900"
                >
                  {copiedCbu ? <Check className="h-3 w-3 text-rose-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedCbu ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
              <span className="font-mono text-gray-800 block break-all">{profile.bankCbu}</span>
            </div>
          </div>
        </div>

        {/* Adjuntar comprobante */}
        <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sage-800">
              <UploadCloud className="h-5 w-5" />
              <h2 className="font-bold text-gray-900">Adjuntar Comprobante</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Formatos admitidos: JPG, PNG, WEBP o PDF (hasta 10 MB).
            </p>

            {uploadError && (
              <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                <FileCheck className="h-4 w-4 shrink-0 text-rose-600" />
                <span>¡Comprobante subido con éxito! Está en proceso de revisión.</span>
              </div>
            )}

            {/* Formulario de subida */}
            {appointment.status !== "CANCELADA" && (
              <form onSubmit={handleFileUpload} className="mt-4 space-y-4">
                <div className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-sage-500 transition">
                  <input
                    type="file"
                    id="proofFileInput"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                        setUploadError(null);
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor="proofFileInput" className="cursor-pointer block">
                    <UploadCloud className="mx-auto h-8 w-8 text-gray-400" />
                    <span className="mt-2 block text-xs font-semibold text-sage-800">
                      {file ? file.name : "Hacé clic para seleccionar tu comprobante"}
                    </span>
                    <span className="text-[11px] text-gray-400 block mt-1">
                      {file
                        ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                        : "Arrastrá el archivo o buscalo en tu dispositivo"}
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-sage-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-sage-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Subiendo archivo...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      <span>Enviar comprobante</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Listado de comprobantes adjuntos */}
            {appointment.payment?.proofs && appointment.payment.proofs.length > 0 && (
              <div className="mt-6 border-t border-warm-200 pt-4">
                <span className="text-xs font-semibold text-gray-700 block mb-2">
                  Comprobantes adjuntos:
                </span>
                <div className="space-y-2">
                  {appointment.payment.proofs.map((proof: any) => (
                    <div
                      key={proof.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700 border border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-sage-600" />
                        <span className="font-medium truncate max-w-[160px] sm:max-w-[200px]">
                          {proof.originalFilename}
                        </span>
                      </div>
                      <a
                        href={`/api/proofs/${proof.id}/download?token=${token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sage-700 hover:text-sage-900 font-semibold"
                      >
                        Ver / Descargar
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botón de Cancelación */}
          {appointment.status !== "CANCELADA" && appointment.status !== "COMPLETADA" && (
            <div className="mt-6 border-t border-warm-200 pt-4 text-right">
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="text-xs text-red-600 hover:text-red-800 hover:underline"
              >
                Cancelar este turno
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cancelación */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">¿Deseás cancelar tu turno?</h3>
            <p className="mt-2 text-xs text-gray-600">
              Por favor dejanos un motivo breve para que la profesional esté informada. Al
              cancelar, el horario se liberará de inmediato.
            </p>

            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de la cancelación..."
              className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-xs text-gray-900 focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
            />

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelAppointment}
                disabled={cancelling}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
              >
                {cancelling ? "Cancelando..." : "Confirmar Cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
