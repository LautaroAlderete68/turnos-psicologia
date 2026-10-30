"use client";

import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  Unlock,
  Trash2,
  Clock,
  User,
  MapPin,
  Video,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  formatTime24h,
  formatDateTimeArgentina,
  getArgentinaDayOfWeek,
  getArgentinaDateString,
  toArgentinaZoned,
} from "@/lib/timezone";

interface AdminCalendarClientProps {
  appointments: any[];
  blocks: any[];
  weeklySchedules: any[];
  profile: any;
}

export default function AdminCalendarClient({
  appointments: initialApps,
  blocks: initialBlocks,
  weeklySchedules,
  profile,
}: AdminCalendarClientProps) {
  const [appointments, setAppointments] = useState(initialApps);
  const [blocks, setBlocks] = useState(initialBlocks);

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Modal para crear bloqueo libre desde la barra superior
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [blockStartTime, setBlockStartTime] = useState("10:00");
  const [blockEndTime, setBlockEndTime] = useState("12:00");
  const [blockReason, setBlockReason] = useState("");
  const [submittingBlock, setSubmittingBlock] = useState(false);

  // Modal específico del candado por día
  const [selectedLockDay, setSelectedLockDay] = useState<Date | null>(null);
  const [dayLockReason, setDayLockReason] = useState("");
  const [customSlotStart, setCustomSlotStart] = useState("09:00");
  const [customSlotEnd, setCustomSlotEnd] = useState("10:00");

  // Modal para detalle de turno
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePrevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const handleNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Abrir modal de candado para un día específico
  const openDayLockModal = (day: Date) => {
    setSelectedLockDay(day);
    setDayLockReason("");
    const dayOfWeek = getArgentinaDayOfWeek(day);
    const schedule = weeklySchedules.find((s: any) => s.dayOfWeek === dayOfWeek);
    const dateStr = format(day, "yyyy-MM-dd");
    const todayStr = getArgentinaDateString(new Date());
    const nowTimeStr = formatTime24h(toArgentinaZoned(new Date()));

    let defaultStart = schedule?.startTime || "09:00";
    if (dateStr === todayStr && defaultStart < nowTimeStr) {
      const [nowH] = nowTimeStr.split(":").map(Number);
      defaultStart = `${String(Math.min(22, nowH + 1)).padStart(2, "0")}:00`;
    }
    setCustomSlotStart(defaultStart);
    const [h, m] = defaultStart.split(":").map(Number);
    const duration = profile?.sessionDuration || 60;
    const endMinutes = h * 60 + m + duration;
    const endH = Math.min(23, Math.floor(endMinutes / 60));
    const endM = endMinutes % 60;
    setCustomSlotEnd(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
  };

  // Crear bloqueo para todo el día
  const handleBlockWholeDay = async () => {
    if (!selectedLockDay) return;
    const dateStr = format(selectedLockDay, "yyyy-MM-dd");
    const todayStr = getArgentinaDateString(new Date());
    if (dateStr < todayStr) {
      alert("No podés bloquear una fecha que ya ha pasado.");
      return;
    }

    setSubmittingBlock(true);
    const reason = dayLockReason.trim() || "Día completo no laborable / Bloqueado";

    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateStr,
          wholeDay: true,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBlocks((prev) => [...prev, data.block]);
      } else {
        alert(data.error || "No se pudo bloquear el día.");
      }
    } catch {
      alert("Error al comunicarse con el servidor.");
    } finally {
      setSubmittingBlock(false);
    }
  };

  // Crear bloqueo para un turno o franja horaria específica
  const handleBlockSlot = async (startTimeStr: string, endTimeStr: string, defaultReason?: string) => {
    if (!selectedLockDay) return;
    const dateStr = format(selectedLockDay, "yyyy-MM-dd");
    const todayStr = getArgentinaDateString(new Date());
    const nowTimeStr = formatTime24h(toArgentinaZoned(new Date()));

    if (dateStr < todayStr || (dateStr === todayStr && startTimeStr < nowTimeStr)) {
      alert("No podés bloquear un horario que ya ha pasado.");
      return;
    }

    const conflictingApp = appointments.find((app) => {
      if (getArgentinaDateString(app.startTime) !== dateStr) return false;
      if (app.status === "CANCELADA") return false;
      const aStart = formatTime24h(app.startTime);
      const aEnd = formatTime24h(app.endTime);
      return startTimeStr < aEnd && endTimeStr > aStart;
    });

    if (conflictingApp) {
      alert("No podés bloquear este horario porque ya cuenta con un turno reservado o con comprobante pendiente de aprobación.");
      return;
    }

    setSubmittingBlock(true);
    const reason = dayLockReason.trim() || defaultReason || `Turno ${startTimeStr} bloqueado`;

    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateStr,
          startTimeStr,
          endTimeStr,
          reason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBlocks((prev) => [...prev, data.block]);
      } else {
        alert(data.error || "No se pudo bloquear el horario.");
      }
    } catch {
      alert("Error al comunicarse con el servidor.");
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockReason.trim()) {
      alert("Indicá el motivo del bloqueo");
      return;
    }

    const todayStr = getArgentinaDateString(new Date());
    const nowTimeStr = formatTime24h(toArgentinaZoned(new Date()));
    if (blockDate < todayStr || (blockDate === todayStr && blockStartTime < nowTimeStr)) {
      alert("No podés crear un bloqueo para una fecha u horario que ya ha pasado.");
      return;
    }

    setSubmittingBlock(true);
    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateStr: blockDate,
          startTimeStr: blockStartTime,
          endTimeStr: blockEndTime,
          reason: blockReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBlocks((prev) => [...prev, data.block]);
        setShowBlockModal(false);
        setBlockReason("");
      } else {
        alert(data.error || "No se pudo crear el bloqueo.");
      }
    } catch {
      alert("Error al comunicarse con el servidor.");
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("¿Deseás eliminar este bloqueo de horario?")) return;

    try {
      const res = await fetch(`/api/admin/blocks?id=${blockId}`, { method: "DELETE" });
      if (res.ok) {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      }
    } catch {
      alert("Error al eliminar el bloqueo");
    }
  };

  // Calcular turnos regulares de atención según weeklySchedules para el día seleccionado
  const getSlotsForSelectedDay = () => {
    if (!selectedLockDay) return { isActive: false, slots: [] };
    const dayOfWeek = getArgentinaDayOfWeek(selectedLockDay);
    const schedule = weeklySchedules.find((s: any) => s.dayOfWeek === dayOfWeek);
    if (!schedule || !schedule.isActive) {
      return { isActive: false, slots: [] };
    }

    const duration = profile?.sessionDuration || 60;
    const buffer = profile?.bufferMinutes ?? 0;
    const step = duration + buffer;

    const [startH, startM] = (schedule.startTime || "09:00").split(":").map(Number);
    const [endH, endM] = (schedule.endTime || "18:00").split(":").map(Number);

    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    const breakStartMins = schedule.breakStartTime
      ? schedule.breakStartTime.split(":").map(Number)[0] * 60 + schedule.breakStartTime.split(":").map(Number)[1]
      : null;
    const breakEndMins = schedule.breakEndTime
      ? schedule.breakEndTime.split(":").map(Number)[0] * 60 + schedule.breakEndTime.split(":").map(Number)[1]
      : null;

    const slots: { start: string; end: string }[] = [];
    for (let m = startMins; m + duration <= endMins; m += step) {
      if (breakStartMins !== null && breakEndMins !== null) {
        if (m < breakEndMins && m + duration > breakStartMins) {
          continue;
        }
      }

      const sH = Math.floor(m / 60);
      const sM = m % 60;
      const eH = Math.floor((m + duration) / 60);
      const eM = (m + duration) % 60;

      const startStr = `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}`;
      const endStr = `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`;

      slots.push({ start: startStr, end: endStr });
    }

    return { isActive: true, slots };
  };

  return (
    <div className="space-y-6">
      {/* Barra superior de controles */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Calendario de Agenda
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista semanal de turnos y gestión de bloqueos de agenda. Hacé clic en el candado de cada día para bloquearlo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-xs">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg"
              title="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-xs font-semibold text-sage-800 hover:bg-sage-50 rounded-lg"
            >
              Hoy
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg"
              title="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setShowBlockModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sage-700 transition"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Bloquear Franja</span>
          </button>
        </div>
      </div>

      {/* Título del rango de la semana */}
      <div className="text-sm font-semibold text-sage-900">
        Semana del {format(currentWeekStart, "d 'de' MMMM", { locale: es })} al{" "}
        {format(addDays(currentWeekStart, 6), "d 'de' MMMM yyyy", { locale: es })}
      </div>

      {/* Grilla Semanal */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
        {weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isToday = isSameDay(day, new Date());
          const dayOfWeek = getArgentinaDayOfWeek(day);
          const schedule = weeklySchedules.find((s: any) => s.dayOfWeek === dayOfWeek);
          const isWorkDay = schedule ? schedule.isActive : false;

          const dayApps = appointments.filter(
            (app) => getArgentinaDateString(app.startTime) === dateStr
          );
          const dayBlocks = blocks.filter(
            (b) => getArgentinaDateString(b.startTime) === dateStr
          );

          // Verificar si el día está totalmente bloqueado de forma manual
          const wholeDayBlock = dayBlocks.find((b) => {
            const bStart = formatTime24h(b.startTime);
            const bEnd = formatTime24h(b.endTime);
            const bStartDate = getArgentinaDateString(b.startTime);
            const bEndDate = getArgentinaDateString(b.endTime);
            return (
              (bStart <= "08:00" && (bEnd >= "20:00" || bEndDate > bStartDate)) ||
              (bStart === "00:00" && (bEnd >= "23:50" || bEndDate > bStartDate))
            );
          });
          const isFullyBlocked = Boolean(wholeDayBlock);
          const hasBlocks = dayBlocks.length > 0;

          return (
            <div
              key={day.toISOString()}
              className={`rounded-2xl border p-3 flex flex-col min-h-[400px] shadow-xs transition ${
                isToday
                  ? "border-sage-500 ring-1 ring-sage-500 bg-white"
                  : !isWorkDay
                  ? "border-dashed border-warm-300 bg-warm-100/50"
                  : "border-warm-200 bg-white"
              }`}
            >
              {/* Encabezado del día con Candado interactivo */}
              <div
                className={`flex items-center justify-between pb-2.5 border-b ${
                  isToday
                    ? "border-sage-200 bg-sage-50/60 -mx-3 -mt-3 p-3 rounded-t-2xl"
                    : "border-warm-200"
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                    {format(day, "EEEE", { locale: es })}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-lg font-extrabold ${
                        isToday ? "text-sage-800" : "text-gray-900"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {!isWorkDay && (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded-md">
                        Cerrado
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón de Candado por Día */}
                <button
                  type="button"
                  onClick={() => openDayLockModal(day)}
                  title={
                    !isWorkDay
                      ? "Día no laborable (bloqueado por defecto en horario semanal). Hacé clic para ver o gestionar excepciones."
                      : isFullyBlocked
                      ? "Día completamente bloqueado (clic para gestionar o desbloquear)"
                      : hasBlocks
                      ? "Día con turnos bloqueados (clic para gestionar o desbloquear)"
                      : "Bloquear día o turnos específicos"
                  }
                  className={`p-2 rounded-xl border transition flex items-center justify-center ${
                    !isWorkDay
                      ? "bg-rose-100/80 border-rose-300 text-rose-800 hover:bg-rose-200 shadow-2xs"
                      : isFullyBlocked
                      ? "bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
                      : hasBlocks
                      ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
                      : "bg-gray-50 border-gray-200 text-gray-400 hover:text-sage-700 hover:bg-sage-50 hover:border-sage-300"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                </button>
              </div>

              {/* Contenido del día (Turnos y Bloqueos) */}
              <div className="mt-3 space-y-2 flex-1 overflow-y-auto">
                {/* Bloqueos del día */}
                {dayBlocks.map((b) => (
                  <div
                    key={b.id}
                    className="group relative rounded-xl border border-gray-300 bg-gray-100 p-2 text-xs text-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold text-gray-900 text-[11px]">
                        <Lock className="h-3 w-3 text-gray-500" />
                        {formatTime24h(b.startTime)} - {formatTime24h(b.endTime)}
                      </span>
                      <button
                        onClick={() => handleDeleteBlock(b.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 p-0.5"
                        title="Eliminar bloqueo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-[11px] text-gray-600 block mt-0.5 truncate">
                      {b.reason}
                    </span>
                  </div>
                ))}

                {/* Turnos del día */}
                {dayApps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`w-full text-left rounded-xl border p-2 text-xs transition shadow-2xs hover:shadow-sm ${
                      app.status === "CONFIRMADA"
                        ? "border-rose-200 bg-rose-50/80 text-rose-950"
                        : app.status === "COMPROBANTE_ENVIADO" || app.payment?.status === "COMPROBANTE_RECIBIDO"
                        ? "border-amber-300 bg-amber-50/90 text-amber-950 ring-1 ring-amber-300/60"
                        : app.status === "CANCELADA"
                        ? "border-gray-200 bg-gray-50 text-gray-400 line-through"
                        : "border-amber-200 bg-amber-50/80 text-amber-950"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span>{formatTime24h(app.startTime)} hs</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full font-semibold">
                        {app.modality === "PRESENCIAL" ? "Presencial" : "Virtual"}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold truncate text-xs">
                      {app.patient.fullName}
                    </div>
                  </button>
                ))}

                {/* Si no hay eventos y no es laborable */}
                {!isWorkDay && dayApps.length === 0 && dayBlocks.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center rounded-xl bg-white/60 border border-warm-200/60 my-auto">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700 mb-2">
                      <Lock className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-800 block">Día No Laborable</span>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      Bloqueado por defecto
                    </span>
                  </div>
                )}

                {/* Si es laborable y no hay eventos */}
                {isWorkDay && dayApps.length === 0 && dayBlocks.length === 0 && (
                  <div className="h-full flex items-center justify-center text-[11px] text-gray-300">
                    Sin eventos
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Candado de Día - Bloquear Día Completo o Turnos Específicos */}
      {/* ========================================================================= */}
      {selectedLockDay && (() => {
        const dateStr = format(selectedLockDay, "yyyy-MM-dd");
        const dayApps = appointments.filter(
          (app) =>
            getArgentinaDateString(app.startTime) === dateStr &&
            app.status !== "CANCELADA" &&
            !(app.status === "PENDIENTE_PAGO" && app.expiresAt && new Date(app.expiresAt) <= new Date())
        );
        const dayBlocks = blocks.filter(
          (b) => getArgentinaDateString(b.startTime) === dateStr
        );
        const { isActive: isDayScheduleActive, slots: rawSlots } = getSlotsForSelectedDay();
        const todayStr = getArgentinaDateString(new Date());
        const nowTimeStr = formatTime24h(toArgentinaZoned(new Date()));
        const isPastDay = dateStr < todayStr;
        const isToday = dateStr === todayStr;

        // Ocultar horarios ya pasados si es hoy (o todos si la fecha entera es pasada)
        const slots = rawSlots.filter((slot) => {
          if (isPastDay) return false;
          if (isToday && slot.start <= nowTimeStr) return false;
          return true;
        });

        const wholeDayBlock = dayBlocks.find((b) => {
          const bStart = formatTime24h(b.startTime);
          const bEnd = formatTime24h(b.endTime);
          const bStartDate = getArgentinaDateString(b.startTime);
          const bEndDate = getArgentinaDateString(b.endTime);
          return (
            (bStart <= "08:00" && (bEnd >= "20:00" || bEndDate > bStartDate)) ||
            (bStart === "00:00" && (bEnd >= "23:50" || bEndDate > bStartDate))
          );
        });
        const isWholeDayBlocked = Boolean(wholeDayBlock);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
              {/* Encabezado del modal */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      Gestión de Bloqueos de Agenda
                    </h3>
                    <p className="text-xs text-gray-500 font-medium capitalize">
                      {format(selectedLockDay, "EEEE d 'de' MMMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLockDay(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Contenido scrolleable */}
              <div className="mt-4 space-y-5 overflow-y-auto pr-1 flex-1 text-xs sm:text-sm">
                {/* Cartel si la fecha entera ya pasó */}
                {isPastDay && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
                    Esta fecha ya ha pasado. No es posible crear ni modificar bloqueos en días anteriores.
                  </div>
                )}

                {/* Cartel explicativo si es fin de semana / no laborable */}
                {!isDayScheduleActive && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                    <div className="flex items-center gap-2 text-rose-900 font-bold text-xs sm:text-sm">
                      <Lock className="h-4 w-4 text-rose-700 shrink-0" />
                      <span>Día No Laborable por Configuración Semanal</span>
                    </div>
                    <p className="mt-1 text-xs text-rose-800/80">
                      Este día (ej. fin de semana o día sin atención) ya está bloqueado por defecto. Ningún paciente puede reservar turnos en esta fecha.
                    </p>
                  </div>
                )}

                {/* Motivo común opcional */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Motivo del bloqueo (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Día no laborable, Vacaciones, Médico, Trámite personal..."
                    value={dayLockReason}
                    onChange={(e) => setDayLockReason(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600 focus:outline-none"
                  />
                </div>

                {/* 1. Opción: Bloquear / Desbloquear Día Completo */}
                {isWholeDayBlocked && wholeDayBlock ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-red-950 flex items-center gap-1.5">
                        <Lock className="h-4 w-4 text-red-700" />
                        Día actualmente bloqueado por completo
                      </span>
                      <span className="text-[11px] text-red-800/80 block mt-0.5">
                        Motivo: {wholeDayBlock.reason}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(wholeDayBlock.id)}
                      className="rounded-xl bg-white border border-red-300 text-red-700 px-4 py-2 text-xs font-bold shadow-xs hover:bg-red-100 transition shrink-0"
                    >
                      Desbloquear Día Completo
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-rose-950 block">
                        Bloquear todo el día
                      </span>
                      <span className="text-[11px] text-rose-800/80 block mt-0.5">
                        Inhabilita todos los turnos de esta jornada para que ningún paciente pueda reservar.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={submittingBlock}
                      onClick={handleBlockWholeDay}
                      className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition shrink-0 disabled:opacity-50"
                    >
                      {submittingBlock ? "Guardando..." : "Bloquear Día Entero"}
                    </button>
                  </div>
                )}

                {/* 2. Opción: Bloquear Turnos Específicos de la Jornada */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-xs sm:text-sm">
                      Bloquear Turnos Individuales ({slots.length} turnos)
                    </span>
                    {!isDayScheduleActive && (
                      <span className="text-[11px] text-rose-700 font-semibold">
                        (Día sin atención habitual)
                      </span>
                    )}
                  </div>

                  {slots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
                      {slots.map((slot) => {
                        // Verificar si ya tiene bloqueo
                        const existingBlock = dayBlocks.find((b) => {
                          const bStart = formatTime24h(b.startTime);
                          const bEnd = formatTime24h(b.endTime);
                          const bStartDate = getArgentinaDateString(b.startTime);
                          const bEndDate = getArgentinaDateString(b.endTime);
                          if (
                            bStartDate < dateStr ||
                            bEndDate > dateStr ||
                            (bStart <= "08:00" && bEnd >= "20:00") ||
                            (bStart === "00:00" && bEnd >= "23:50")
                          ) {
                            return true;
                          }
                          return slot.start < bEnd && slot.end > bStart;
                        });

                        // Verificar si tiene turno reservado
                        const existingApp = dayApps.find((app) => {
                          const aStart = formatTime24h(app.startTime);
                          const aEnd = formatTime24h(app.endTime);
                          return slot.start < aEnd && slot.end > aStart;
                        });

                        const isProofPending = Boolean(
                          existingApp &&
                            (existingApp.status === "COMPROBANTE_ENVIADO" ||
                              existingApp.payment?.status === "COMPROBANTE_RECIBIDO")
                        );

                        return (
                          <div
                            key={slot.start}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                              existingBlock
                                ? "bg-red-50 border-red-200 text-red-900"
                                : isProofPending
                                ? "bg-amber-50/80 border-amber-300 text-amber-950 ring-1 ring-amber-300/60"
                                : existingApp
                                ? "bg-rose-50 border-rose-200 text-rose-900"
                                : "bg-white border-gray-200 text-gray-800"
                            }`}
                          >
                            <div>
                              <span className="font-bold block">
                                {slot.start} - {slot.end} hs
                              </span>
                              {existingBlock ? (
                                <span className="text-[10px] text-red-600 block truncate max-w-[140px]">
                                  Bloqueado ({existingBlock.reason})
                                </span>
                              ) : isProofPending ? (
                                <span className="text-[10px] text-amber-800 font-semibold block truncate max-w-[140px]">
                                  Turno: {existingApp.patient.fullName} (En revisión)
                                </span>
                              ) : existingApp ? (
                                <span className="text-[10px] text-rose-700 font-semibold block truncate max-w-[140px]">
                                  Turno: {existingApp.patient.fullName}
                                </span>
                              ) : (
                                <span className="text-[10px] text-sage-600 font-medium block">
                                  Disponible
                                </span>
                              )}
                            </div>

                            {existingBlock ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(existingBlock.id)}
                                className="px-2 py-1 bg-white hover:bg-red-100 text-red-700 font-semibold text-[11px] rounded-md border border-red-200 transition"
                                title="Desbloquear este turno"
                              >
                                Desbloquear
                              </button>
                            ) : isProofPending ? (
                              <span className="text-[10px] font-semibold text-amber-800 uppercase px-2 py-0.5 bg-amber-100 rounded border border-amber-300 shadow-2xs">
                                Reservado
                              </span>
                            ) : existingApp ? (
                              <span className="text-[10px] font-semibold text-rose-600 uppercase px-1.5 py-0.5 bg-white rounded border border-rose-200">
                                Reservado
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={submittingBlock}
                                onClick={() =>
                                  handleBlockSlot(
                                    slot.start,
                                    slot.end,
                                    `Turno ${slot.start} bloqueado`
                                  )
                                }
                                className="px-2 py-1 bg-sage-600 hover:bg-sage-700 text-white font-semibold text-[11px] rounded-md shadow-2xs transition disabled:opacity-50"
                              >
                                Bloquear
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl border">
                      {isPastDay
                        ? "Esta fecha ya pasó."
                        : isToday && rawSlots.length > 0
                        ? "Todos los turnos de la jornada de hoy ya han transcurrido."
                        : "No hay horarios habituales para este día. Podés usar el bloqueo de día completo o especificar una franja personalizada abajo."}
                    </p>
                  )}
                </div>

                {/* 3. Opción: Franja Horaria Personalizada */}
                <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-3">
                  <span className="font-semibold text-gray-800 text-xs block">
                    O bloquear una franja horaria personalizada:
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Hora Inicio</label>
                      <input
                        type="time"
                        value={customSlotStart}
                        onChange={(e) => setCustomSlotStart(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-2 text-xs text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Hora Fin</label>
                      <input
                        type="time"
                        value={customSlotEnd}
                        onChange={(e) => setCustomSlotEnd(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 p-2 text-xs text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={submittingBlock}
                      onClick={() =>
                        handleBlockSlot(
                          customSlotStart,
                          customSlotEnd,
                          `Franja ${customSlotStart} - ${customSlotEnd} bloqueada`
                        )
                      }
                      className="rounded-xl bg-gray-800 hover:bg-gray-900 text-white px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                    >
                      Bloquear Franja
                    </button>
                  </div>
                </div>

                {/* 4. Bloqueos Activos de Este Día */}
                {dayBlocks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <span className="font-bold text-gray-900 text-xs block">
                      Bloqueos activos en este día ({dayBlocks.length}):
                    </span>
                    <div className="space-y-1.5">
                      {dayBlocks.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-lg bg-gray-100 p-2 text-xs text-gray-700 border border-gray-200"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Lock className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            <span className="font-semibold text-gray-900">
                              {formatTime24h(b.startTime)} - {formatTime24h(b.endTime)}
                            </span>
                            <span className="text-gray-500 truncate text-[11px]">
                              • {b.reason}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(b.id)}
                            className="text-red-600 hover:text-red-800 font-semibold text-xs ml-2 shrink-0 p-1 rounded hover:bg-red-50"
                            title="Eliminar bloqueo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de cierre */}
              <div className="mt-4 pt-3 border-t flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLockDay(null)}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
                >
                  Listo / Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* Modal: Crear Bloqueo Libre desde barra superior */}
      {/* ========================================================================= */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">Bloquear Franja Horaria</h3>
              <button
                onClick={() => setShowBlockModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-gray-700">Fecha</label>
                <input
                  type="date"
                  required
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700">Hora Inicio</label>
                  <input
                    type="time"
                    required
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700">Hora Fin</label>
                  <input
                    type="time"
                    required
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700">
                  Motivo (ej: Vacaciones, Congreso, Supervisión)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Reunión personal..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingBlock}
                  className="rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sage-700 disabled:bg-gray-400"
                >
                  {submittingBlock ? "Guardando..." : "Crear Bloqueo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal: Detalle de Turno */}
      {/* ========================================================================= */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-gray-500">
                  {selectedApp.publicCode}
                </span>
                <h3 className="font-bold text-gray-900 text-lg">
                  {selectedApp.patient.fullName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-warm-50 p-3">
                <div>
                  <span className="text-gray-500 block text-[11px]">Horario:</span>
                  <span className="font-semibold text-gray-900">
                    {formatDateTimeArgentina(selectedApp.startTime)} hs
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Modalidad:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedApp.modality === "PRESENCIAL" ? "Presencial" : "Virtual"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Teléfono:</span>
                  <span className="font-semibold text-gray-900">{selectedApp.patient.phone}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Email:</span>
                  <span className="font-semibold text-gray-900">{selectedApp.patient.email}</span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 block text-[11px]">Estado del Turno:</span>
                <span className="font-bold text-sage-900">{selectedApp.status}</span>
              </div>

              {selectedApp.adminNotes && (
                <div>
                  <span className="text-gray-500 block text-[11px]">Notas Administrativas:</span>
                  <p className="mt-0.5 rounded-lg bg-gray-50 p-2 text-gray-700">
                    {selectedApp.adminNotes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
