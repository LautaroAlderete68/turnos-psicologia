"use client";

import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  Trash2,
  Clock,
  User,
  MapPin,
  Video,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { formatTime24h, formatDateTimeArgentina } from "@/lib/timezone";

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

  // Modal para crear bloqueo
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [blockStartTime, setBlockStartTime] = useState("10:00");
  const [blockEndTime, setBlockEndTime] = useState("12:00");
  const [blockReason, setBlockReason] = useState("");
  const [submittingBlock, setSubmittingBlock] = useState(false);

  // Modal para detalle de turno
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePrevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const handleNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const handleToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockReason.trim()) {
      alert("Indicá el motivo del bloqueo");
      return;
    }

    setSubmittingBlock(true);
    try {
      const startIso = `${blockDate}T${blockStartTime}:00`;
      const endIso = `${blockDate}T${blockEndTime}:00`;

      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startIso,
          endTime: endIso,
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

  return (
    <div className="space-y-6">
      {/* Barra superior de controles */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Calendario de Agenda
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista semanal de turnos y gestión de bloqueos de agenda.
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
          const isToday = isSameDay(day, new Date());
          const dayApps = appointments.filter((app) =>
            isSameDay(parseISO(app.startTime), day)
          );
          const dayBlocks = blocks.filter((b) =>
            isSameDay(parseISO(b.startTime), day)
          );

          return (
            <div
              key={day.toISOString()}
              className={`rounded-2xl border p-3 flex flex-col min-h-[380px] bg-white shadow-xs ${
                isToday ? "border-sage-500 ring-1 ring-sage-500" : "border-warm-200"
              }`}
            >
              {/* Encabezado del día */}
              <div
                className={`text-center pb-2.5 border-b ${
                  isToday ? "border-sage-200 bg-sage-50/60 -mx-3 -mt-3 p-3 rounded-t-2xl" : "border-warm-200"
                }`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                  {format(day, "EEEE", { locale: es })}
                </span>
                <span
                  className={`text-lg font-extrabold ${
                    isToday ? "text-sage-800" : "text-gray-900"
                  }`}
                >
                  {format(day, "d")}
                </span>
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
                        ? "border-green-200 bg-green-50/80 text-green-950"
                        : app.status === "COMPROBANTE_ENVIADO"
                        ? "border-blue-200 bg-blue-50/80 text-blue-950"
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

                {dayApps.length === 0 && dayBlocks.length === 0 && (
                  <div className="h-full flex items-center justify-center text-[11px] text-gray-300">
                    Sin actividad
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Crear Bloqueo de Franja */}
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

      {/* Modal: Detalle de Turno */}
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
