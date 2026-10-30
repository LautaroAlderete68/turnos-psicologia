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
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react";
import { format, addDays, startOfWeek, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateTimeArgentina } from "@/lib/timezone";
import { compressImageFile } from "@/lib/client-compress";

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

interface DayData {
  date: string;
  dayOfWeek: number;
  isOpen: boolean;
  closedReason?: string;
  slots: TimeSlot[];
}

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

  // Estado del uploader de comprobante
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Cancelación (solo turnos pendientes o con comprobante en revisión)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Reprogramación (solo turnos confirmados con anticipación)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleWeekStart, setRescheduleWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [rescheduleDaysData, setRescheduleDaysData] = useState<DayData[]>([]);
  const [loadingRescheduleWeek, setLoadingRescheduleWeek] = useState(false);
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState<string>("");
  const [selectedRescheduleTime, setSelectedRescheduleTime] = useState<string>("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleSuccessMsg, setRescheduleSuccessMsg] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Contador de expiración si está pendiente de pago
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // Reglas de negocio sobre estados
  const isConfirmed =
    appointment.status === "CONFIRMADA" || appointment.payment?.status === "APROBADO";
  const isUnconfirmed =
    !isConfirmed &&
    appointment.status !== "CANCELADA" &&
    appointment.status !== "COMPLETADA";

  // Anticipación en horas para reprogramar
  const noticeHours = profile?.rescheduleNoticeHours ?? 24;
  const nowMs = new Date().getTime();
  const appointmentStartMs = new Date(appointment.startTime).getTime();
  const hoursUntilAppointment = (appointmentStartMs - nowMs) / (1000 * 60 * 60);
  const canReschedule =
    isConfirmed &&
    hoursUntilAppointment >= noticeHours &&
    appointment.status !== "CANCELADA" &&
    appointment.status !== "COMPLETADA";

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
      // Optimizar compresión en el cliente para reducir transferencia y consumo
      const optimizedFile = await compressImageFile(file);

      const formData = new FormData();
      formData.append("file", optimizedFile);
      formData.append("appointmentId", appointment.id);
      formData.append("patientToken", token);
      formData.append("token", token);

      const res = await fetch("/api/proofs/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setUploadError(
          data?.error || `Error del servidor (${res.status}): No se pudo procesar el comprobante.`
        );
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
              originalFilename: optimizedFile.name,
            },
            ...(prev.payment?.proofs || []),
          ],
        },
      }));
    } catch (err: any) {
      console.error("Error al cargar comprobante:", err);
      setUploadError(
        err?.message ? `Error de carga: ${err.message}` : "Error de conexión al cargar el archivo."
      );
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
          token,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
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

  // Carga de disponibilidad para la modal de reprogramación
  const loadRescheduleWeek = async (weekStart: Date) => {
    setLoadingRescheduleWeek(true);
    setRescheduleError(null);
    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(format(addDays(weekStart, i), "yyyy-MM-dd"));
    }

    try {
      const res = await fetch(`/api/availability?dates=${weekDays.join(",")}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRescheduleDaysData(data.days);
        // Seleccionar primer día disponible si no hay fecha seleccionada en esta semana
        const found = data.days.find(
          (d: DayData) => d.isOpen && d.slots.some((s) => s.available)
        );
        if (found) {
          setSelectedRescheduleDate(found.date);
          setSelectedRescheduleTime("");
        }
      } else {
        setRescheduleError(data.error || "No se pudo cargar la disponibilidad.");
      }
    } catch {
      setRescheduleError("Error de conexión al cargar horarios.");
    } finally {
      setLoadingRescheduleWeek(false);
    }
  };

  const handleOpenRescheduleModal = () => {
    setShowRescheduleModal(true);
    setRescheduleError(null);
    loadRescheduleWeek(rescheduleWeekStart);
  };

  const handlePrevRescheduleWeek = () => {
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const newStart = addDays(rescheduleWeekStart, -7);
    if (isBefore(newStart, currentWeekStart)) return;
    setRescheduleWeekStart(newStart);
    loadRescheduleWeek(newStart);
  };

  const handleNextRescheduleWeek = () => {
    const newStart = addDays(rescheduleWeekStart, 7);
    setRescheduleWeekStart(newStart);
    loadRescheduleWeek(newStart);
  };

  const handleConfirmReschedule = async () => {
    if (!selectedRescheduleDate || !selectedRescheduleTime) {
      alert("Por favor seleccioná un día y un horario disponible.");
      return;
    }

    setRescheduling(true);
    setRescheduleError(null);

    try {
      const res = await fetch("/api/patient/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          token,
          dateStr: selectedRescheduleDate,
          timeStr: selectedRescheduleTime,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAppointment((prev: any) => ({
          ...prev,
          startTime: data.newStartTime,
          endTime: data.newEndTime,
        }));
        setShowRescheduleModal(false);
        setRescheduleSuccessMsg("¡Tu turno fue reprogramado con éxito!");
        setTimeout(() => setRescheduleSuccessMsg(null), 8000);
      } else {
        setRescheduleError(data.error || "No se pudo reprogramar el turno.");
      }
    } catch {
      setRescheduleError("Error al procesar la reprogramación.");
    } finally {
      setRescheduling(false);
    }
  };

  // Badges visuales
  const getReservationBadge = (status: string) => {
    switch (status) {
      case "CONFIRMADA":
        return (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
            Turno Confirmado
          </span>
        );
      case "COMPROBANTE_ENVIADO":
        return (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            Comprobante en Revisión
          </span>
        );
      case "PENDIENTE_PAGO":
        return (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Pendiente de Pago
          </span>
        );
      case "CANCELADA":
        return (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            Cancelado
          </span>
        );
      case "COMPLETADA":
        return (
          <span className="rounded-full bg-rose-200 px-3 py-1 text-xs font-semibold text-rose-900">
            Completado
          </span>
        );
      case "AUSENTE":
        return (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
            Ausente
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "APROBADO":
        return (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
            Pago Aprobado
          </span>
        );
      case "COMPROBANTE_RECIBIDO":
        return (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            Comprobante Recibido
          </span>
        );
      case "PENDIENTE":
        return (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Pago Pendiente
          </span>
        );
      case "RECHAZADO":
        return (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
            Pago Rechazado
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
            {status}
          </span>
        );
    }
  };

  const selectedDayData = rescheduleDaysData.find((d) => d.date === selectedRescheduleDate);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Alerta de reprogramación exitosa */}
      {rescheduleSuccessMsg && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-semibold">{rescheduleSuccessMsg}</span>
          </div>
          <button
            onClick={() => setRescheduleSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

        {/* Banner de Acceso a Sesión Virtual */}
        {appointment.modality === "VIRTUAL" && appointment.meetingUrl && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-center sm:text-left sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-rose-800 font-bold">
                <Video className="h-5 w-5" />
                <span>Videollamada en Google Meet Confirmada</span>
              </div>
              <p className="mt-1 text-xs text-rose-900/80">
                Tu sesión virtual está lista. Podés ingresar directamente en el horario pautado.
              </p>
            </div>
            <a
              href={appointment.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 sm:mt-0 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-rose-700 transition active:scale-95 shrink-0"
            >
              <span>Ingresar a Google Meet</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECCIÓN DE GESTIÓN: REPROGRAMACIÓN PARA TURNOS CONFIRMADOS */}
        {/* ================================================================= */}
        {isConfirmed && appointment.status !== "CANCELADA" && appointment.status !== "COMPLETADA" && (
          <div className="mt-6 rounded-2xl border border-warm-200 bg-warm-50/80 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-sage-700" />
                <span>Reprogramación de Turno</span>
              </h3>
              <p className="mt-1 text-xs text-gray-600 max-w-xl">
                {canReschedule ? (
                  <>
                    Podés cambiar la fecha y horario de tu sesión respetando el plazo de anticipación
                    mínima de <strong>{noticeHours} horas</strong>.
                  </>
                ) : (
                  <>
                    Este turno no puede reprogramarse desde el portal porque restan menos de{" "}
                    <strong>{noticeHours} horas</strong> para el horario pautado. Para emergencias o
                    consultas, comunicate directamente por WhatsApp.
                  </>
                )}
              </p>
            </div>

            <div className="mt-4 sm:mt-0 shrink-0">
              <button
                type="button"
                disabled={!canReschedule}
                onClick={handleOpenRescheduleModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-rose-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reprogramar Turno</span>
              </button>
            </div>
          </div>
        )}
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

          {/* Botón de Cancelación: SÓLO visible si aún no se ha confirmado el pago */}
          {isUnconfirmed && (
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

      {/* ===================================================================== */}
      {/* MODAL DE REPROGRAMACIÓN DE TURNO */}
      {/* ===================================================================== */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-warm-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Reprogramar Turno</h3>
                <p className="text-xs text-gray-500">
                  Seleccioná una nueva fecha y horario disponible para tu sesión.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {rescheduleError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{rescheduleError}</span>
              </div>
            )}

            {/* Navegación de Semanas */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-warm-50 p-3">
              <button
                type="button"
                onClick={handlePrevRescheduleWeek}
                disabled={isBefore(
                  addDays(rescheduleWeekStart, -7),
                  startOfWeek(new Date(), { weekStartsOn: 1 })
                )}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Semana anterior</span>
              </button>

              <span className="text-xs sm:text-sm font-bold text-sage-950">
                Semana del {format(rescheduleWeekStart, "d 'de' MMMM", { locale: es })}
              </span>

              <button
                type="button"
                onClick={handleNextRescheduleWeek}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50"
              >
                <span className="hidden sm:inline">Próxima semana</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Selector de Días de la Semana */}
            {loadingRescheduleWeek ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin text-sage-600" />
                <span className="mt-2 text-xs">Consultando disponibilidad...</span>
              </div>
            ) : (
              <div className="mt-4">
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {rescheduleDaysData.map((d) => {
                    const dayDate = new Date(`${d.date}T12:00:00`);
                    const isSelected = selectedRescheduleDate === d.date;
                    const hasAvailable = d.isOpen && d.slots.some((s) => s.available);

                    return (
                      <button
                        key={d.date}
                        type="button"
                        disabled={!d.isOpen || !hasAvailable}
                        onClick={() => {
                          setSelectedRescheduleDate(d.date);
                          setSelectedRescheduleTime("");
                        }}
                        className={`flex flex-col items-center rounded-xl p-2 sm:p-2.5 transition text-center border ${
                          isSelected
                            ? "border-rose-600 bg-rose-50 text-rose-950 shadow-xs"
                            : hasAvailable
                            ? "border-gray-200 bg-white hover:border-sage-400 text-gray-800"
                            : "border-gray-100 bg-gray-50/70 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-semibold text-gray-500">
                          {format(dayDate, "EEE", { locale: es })}
                        </span>
                        <span className="text-sm sm:text-base font-bold my-0.5">
                          {format(dayDate, "d")}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {format(dayDate, "MMM", { locale: es })}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Horarios disponibles para el día seleccionado */}
                <div className="mt-6 border-t border-warm-200 pt-4">
                  <h4 className="text-xs font-bold text-gray-800 mb-2">
                    {selectedRescheduleDate ? (
                      <>
                        Horarios disponibles para el{" "}
                        {format(new Date(`${selectedRescheduleDate}T12:00:00`), "EEEE d 'de' MMMM", {
                          locale: es,
                        })}
                        :
                      </>
                    ) : (
                      "Seleccioná un día para ver los horarios disponibles"
                    )}
                  </h4>

                  {selectedDayData && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-3">
                      {selectedDayData.slots.map((slot) => {
                        const isChosen = selectedRescheduleTime === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setSelectedRescheduleTime(slot.time)}
                            className={`rounded-xl py-2 px-3 text-xs font-bold transition border ${
                              isChosen
                                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                : slot.available
                                ? "bg-white text-gray-800 border-gray-200 hover:border-sage-500 hover:bg-sage-50"
                                : "bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed line-through"
                            }`}
                          >
                            {slot.time} hs
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedDayData && selectedDayData.slots.filter((s) => s.available).length === 0 && (
                    <p className="mt-4 text-center text-xs text-gray-500">
                      No quedan horarios libres para este día. Por favor seleccioná otra fecha.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-end gap-2 border-t border-warm-200 pt-4">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedRescheduleDate || !selectedRescheduleTime || rescheduling}
                onClick={handleConfirmReschedule}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {rescheduling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Reprogramando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Confirmar Reprogramación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE CANCELACIÓN (Solo disponible si no se ha pagado aún) */}
      {/* ===================================================================== */}
      {showCancelModal && isUnconfirmed && (
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
