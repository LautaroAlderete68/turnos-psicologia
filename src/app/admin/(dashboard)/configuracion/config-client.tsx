"use client";

import React, { useState } from "react";
import {
  Save,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  User,
  CreditCard,
  Shield,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

interface AdminConfigClientProps {
  profile: any;
  weeklySchedules: any[];
  exceptions: any[];
}

const dayNames = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export default function AdminConfigClient({
  profile: initialProfile,
  weeklySchedules: initialWeekly,
  exceptions: initialExceptions,
}: AdminConfigClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [weeklySchedules, setWeeklySchedules] = useState(initialWeekly);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleProfileChange = (field: string, value: any) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleWeeklyChange = (dayOfWeek: number, field: string, value: any) => {
    setWeeklySchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(false);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileData: profile,
          weeklySchedules,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      } else {
        setErrorMessage(data.error || "No se pudo guardar la configuración.");
      }
    } catch {
      setErrorMessage("Error al conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl pb-16">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Configuración del Consultorio
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrá tu perfil profesional, honorarios, horarios habituales y políticas.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-xl bg-sage-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-sage-700 disabled:bg-gray-400 transition"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Guardando...</span>
            </>
          ) : successMessage ? (
            <>
              <Check className="h-4 w-4 text-green-300" />
              <span>¡Guardado!</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Guardar Cambios</span>
            </>
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Información Profesional y Contacto */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sage-800 border-b border-warm-200 pb-3">
          <User className="h-5 w-5" />
          <h2 className="text-base font-bold text-gray-900">Perfil Profesional y Contacto</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700">Nombre Profesional</label>
            <input
              type="text"
              required
              value={profile.fullName || ""}
              onChange={(e) => handleProfileChange("fullName", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Matrícula (M.N. / M.P.)</label>
            <input
              type="text"
              required
              value={profile.license || ""}
              onChange={(e) => handleProfileChange("license", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Especialidad / Enfoque</label>
            <input
              type="text"
              value={profile.specialty || ""}
              onChange={(e) => handleProfileChange("specialty", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Teléfono / WhatsApp</label>
            <input
              type="text"
              value={profile.phone || ""}
              onChange={(e) => handleProfileChange("phone", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Email de Consultas</label>
            <input
              type="email"
              value={profile.email || ""}
              onChange={(e) => handleProfileChange("email", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Dirección del Consultorio</label>
            <input
              type="text"
              value={profile.address || ""}
              onChange={(e) => handleProfileChange("address", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700">Presentación / Bio</label>
          <textarea
            rows={3}
            value={profile.bio || ""}
            onChange={(e) => handleProfileChange("bio", e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
          />
        </div>
      </div>

      {/* 2. Parámetros de la Sesión y Reglas de Reserva */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sage-800 border-b border-warm-200 pb-3">
          <Clock className="h-5 w-5" />
          <h2 className="text-base font-bold text-gray-900">Sesión y Reglas de la Agenda</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700">Honorario por Sesión ($ ARS)</label>
            <input
              type="number"
              required
              value={profile.sessionPrice || 0}
              onChange={(e) => handleProfileChange("sessionPrice", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Duración Sesión (Minutos)</label>
            <input
              type="number"
              required
              value={profile.sessionDuration || 60}
              onChange={(e) => handleProfileChange("sessionDuration", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Intervalo entre Sesiones (Minutos)</label>
            <input
              type="number"
              required
              value={profile.bufferMinutes || 10}
              onChange={(e) => handleProfileChange("bufferMinutes", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Anticipación Mínima (Horas)</label>
            <input
              type="number"
              required
              value={profile.minNoticeHours || 4}
              onChange={(e) => handleProfileChange("minNoticeHours", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Anticipación Máxima (Días)</label>
            <input
              type="number"
              required
              value={profile.maxAdvanceDays || 30}
              onChange={(e) => handleProfileChange("maxAdvanceDays", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Vencimiento Reserva Pendiente (Minutos)</label>
            <input
              type="number"
              required
              value={profile.pendingExpirationMinutes || 120}
              onChange={(e) => handleProfileChange("pendingExpirationMinutes", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-sage-600"
            />
          </div>
        </div>

        <div className="flex gap-6 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={profile.allowPresencial ?? true}
              onChange={(e) => handleProfileChange("allowPresencial", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
            />
            <span>Habilitar atención presencial</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={profile.allowVirtual ?? true}
              onChange={(e) => handleProfileChange("allowVirtual", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
            />
            <span>Habilitar atención virtual</span>
          </label>
        </div>
      </div>

      {/* 3. Días y Horarios Habituales de Atención */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sage-800 border-b border-warm-200 pb-3">
          <Calendar className="h-5 w-5" />
          <h2 className="text-base font-bold text-gray-900">Horarios Semanales de Atención</h2>
        </div>

        <div className="space-y-3">
          {weeklySchedules.map((schedule) => {
            const dayName = dayNames[schedule.dayOfWeek];
            return (
              <div
                key={schedule.dayOfWeek}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition ${
                  schedule.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 w-36">
                  <input
                    type="checkbox"
                    id={`day-${schedule.dayOfWeek}`}
                    checked={schedule.isActive}
                    onChange={(e) =>
                      handleWeeklyChange(schedule.dayOfWeek, "isActive", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-sage-600"
                  />
                  <label
                    htmlFor={`day-${schedule.dayOfWeek}`}
                    className="font-semibold text-xs text-gray-900 cursor-pointer"
                  >
                    {dayName}
                  </label>
                </div>

                {schedule.isActive ? (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500">De:</span>
                      <input
                        type="time"
                        value={schedule.startTime}
                        onChange={(e) =>
                          handleWeeklyChange(schedule.dayOfWeek, "startTime", e.target.value)
                        }
                        className="rounded-lg border border-gray-200 p-1.5 text-xs text-gray-800"
                      />
                      <span className="text-gray-500">a</span>
                      <input
                        type="time"
                        value={schedule.endTime}
                        onChange={(e) =>
                          handleWeeklyChange(schedule.dayOfWeek, "endTime", e.target.value)
                        }
                        className="rounded-lg border border-gray-200 p-1.5 text-xs text-gray-800"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-400">
                      <span>(Pausa almuerzo:</span>
                      <input
                        type="time"
                        value={schedule.breakStartTime || ""}
                        onChange={(e) =>
                          handleWeeklyChange(schedule.dayOfWeek, "breakStartTime", e.target.value)
                        }
                        className="rounded-lg border border-gray-200 p-1.5 text-xs text-gray-800"
                      />
                      <span>a</span>
                      <input
                        type="time"
                        value={schedule.breakEndTime || ""}
                        onChange={(e) =>
                          handleWeeklyChange(schedule.dayOfWeek, "breakEndTime", e.target.value)
                        }
                        className="rounded-lg border border-gray-200 p-1.5 text-xs text-gray-800"
                      />
                      <span>)</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">Sin atención este día</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Datos Bancarios e Instrucciones de Pago */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sage-800 border-b border-warm-200 pb-3">
          <CreditCard className="h-5 w-5" />
          <h2 className="text-base font-bold text-gray-900">Datos Bancarios para Transferencias</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700">Banco / Entidad</label>
            <input
              type="text"
              value={profile.bankName || ""}
              onChange={(e) => handleProfileChange("bankName", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Titular de la Cuenta</label>
            <input
              type="text"
              value={profile.bankAccountHolder || ""}
              onChange={(e) => handleProfileChange("bankAccountHolder", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">Alias Bancario</label>
            <input
              type="text"
              value={profile.bankAlias || ""}
              onChange={(e) => handleProfileChange("bankAlias", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">CBU / CVU</label>
            <input
              type="text"
              value={profile.bankCbu || ""}
              onChange={(e) => handleProfileChange("bankCbu", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700">
            Instrucciones para el Paciente
          </label>
          <textarea
            rows={2}
            value={profile.paymentInstructions || ""}
            onChange={(e) => handleProfileChange("paymentInstructions", e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
          />
        </div>
      </div>

      {/* 5. Políticas y Aviso de Privacidad */}
      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sage-800 border-b border-warm-200 pb-3">
          <Shield className="h-5 w-5" />
          <h2 className="text-base font-bold text-gray-900">Políticas y Aviso Legal</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700">
            Política de Cancelación y Reprogramación
          </label>
          <textarea
            rows={2}
            value={profile.cancellationPolicy || ""}
            onChange={(e) => handleProfileChange("cancellationPolicy", e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700">
            Aviso de Privacidad (Ley 25.326)
          </label>
          <textarea
            rows={3}
            value={profile.privacyNotice || ""}
            onChange={(e) => handleProfileChange("privacyNotice", e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900"
          />
        </div>
      </div>
    </form>
  );
}
