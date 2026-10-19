"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  Video,
  X,
  Edit2,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatDateTimeArgentina } from "@/lib/timezone";

interface ReservationsClientProps {
  appointments: any[];
}

export default function AdminReservationsClient({
  appointments: initialApps,
}: ReservationsClientProps) {
  const [appointments, setAppointments] = useState(initialApps);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [modalityFilter, setModalityFilter] = useState("TODAS");

  // Modal de edición de turno
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Filtrado reactivo en cliente
  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const matchSearch =
        searchTerm === "" ||
        app.patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.publicCode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === "TODOS" || app.status === statusFilter;
      const matchModality = modalityFilter === "TODAS" || app.modality === modalityFilter;

      return matchSearch && matchStatus && matchModality;
    });
  }, [appointments, searchTerm, statusFilter, modalityFilter]);

  const openEditModal = (app: any) => {
    setSelectedApp(app);
    setNewStatus(app.status);
    setAdminNotes(app.adminNotes || "");
    setCancellationReason(app.cancellationReason || "");
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/appointments/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: selectedApp.id,
          status: newStatus,
          adminNotes: adminNotes.trim(),
          cancellationReason: newStatus === "CANCELADA" ? cancellationReason.trim() : null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === selectedApp.id
              ? {
                  ...a,
                  status: newStatus,
                  adminNotes: adminNotes.trim(),
                  cancellationReason:
                    newStatus === "CANCELADA" ? cancellationReason.trim() : null,
                }
              : a
          )
        );
        setSelectedApp(null);
      } else {
        alert(data.error || "No se pudo actualizar el turno.");
      }
    } catch {
      alert("Error al comunicarse con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Gestión de Turnos
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Listado general de reservas, filtros por estado y notas administrativas.
        </p>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col gap-3 rounded-2xl border border-warm-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por paciente, email o código TRN-..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2 text-xs sm:text-sm text-gray-900 focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm text-gray-700 focus:border-sage-600 focus:outline-none"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="PENDIENTE_PAGO">Pendiente de Pago</option>
            <option value="COMPROBANTE_ENVIADO">Comprobante Enviado</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="COMPLETADA">Completada</option>
            <option value="CANCELADA">Cancelada</option>
            <option value="AUSENTE">Ausente</option>
          </select>

          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm text-gray-700 focus:border-sage-600 focus:outline-none"
          >
            <option value="TODAS">Todas las modalidades</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="VIRTUAL">Virtual</option>
          </select>
        </div>
      </div>

      {/* Tabla de Reservas */}
      <div className="rounded-2xl border border-warm-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-warm-50 text-gray-600 font-semibold border-b border-warm-200">
              <tr>
                <th className="p-3.5">Código</th>
                <th className="p-3.5">Paciente</th>
                <th className="p-3.5">Fecha y Horario</th>
                <th className="p-3.5">Modalidad</th>
                <th className="p-3.5">Estado Reserva</th>
                <th className="p-3.5">Estado Pago</th>
                <th className="p-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    No se encontraron reservas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((app) => (
                  <tr key={app.id} className="hover:bg-warm-50/50 transition">
                    <td className="p-3.5 font-mono font-bold text-gray-700">{app.publicCode}</td>
                    <td className="p-3.5">
                      <span className="font-semibold text-gray-900 block">{app.patient.fullName}</span>
                      <span className="text-[11px] text-gray-400 block">{app.patient.email}</span>
                    </td>
                    <td className="p-3.5 text-gray-800">
                      {formatDateTimeArgentina(app.startTime)} hs
                    </td>
                    <td className="p-3.5 text-gray-600">
                      {app.modality === "PRESENCIAL" ? "Presencial" : "Virtual"}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          app.status === "CONFIRMADA"
                            ? "bg-green-100 text-green-800"
                            : app.status === "COMPROBANTE_ENVIADO"
                            ? "bg-blue-100 text-blue-800"
                            : app.status === "PENDIENTE_PAGO"
                            ? "bg-amber-100 text-amber-800"
                            : app.status === "CANCELADA"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          app.payment?.status === "APROBADO"
                            ? "bg-green-100 text-green-800"
                            : app.payment?.status === "COMPROBANTE_RECIBIDO"
                            ? "bg-blue-100 text-blue-800"
                            : app.payment?.status === "RECHAZADO"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {app.payment?.status || "PENDIENTE"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openEditModal(app)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Editar Estado y Notas */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-gray-500">
                  {selectedApp.publicCode}
                </span>
                <h3 className="font-bold text-gray-900 text-lg">
                  Gestionar Turno: {selectedApp.patient.fullName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-gray-700">Estado de la Reserva</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
                >
                  <option value="PENDIENTE_PAGO">PENDIENTE_PAGO</option>
                  <option value="COMPROBANTE_ENVIADO">COMPROBANTE_ENVIADO</option>
                  <option value="CONFIRMADA">CONFIRMADA</option>
                  <option value="COMPLETADA">COMPLETADA</option>
                  <option value="CANCELADA">CANCELADA</option>
                  <option value="AUSENTE">AUSENTE</option>
                </select>
              </div>

              {newStatus === "CANCELADA" && (
                <div>
                  <label className="block font-semibold text-red-700">Motivo de Cancelación</label>
                  <input
                    type="text"
                    required
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Ej: Solicitud del paciente, fuerza mayor..."
                    className="mt-1 w-full rounded-xl border border-red-200 p-2.5 text-xs text-gray-900 focus:border-red-600"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700">
                  Notas Administrativas (No Clínicas)
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Ej: Solicitó factura B, cambiar a virtual si llueve..."
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sage-700 disabled:bg-gray-400"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
