"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  CreditCard,
} from "lucide-react";
import { format, addDays, startOfWeek, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

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

export default function ReservarPage() {
  const router = useRouter();

  // Paso actual (1: Selección fecha/hora, 2: Datos personales, 3: Confirmación)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Estado del flujo
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [weekDaysData, setWeekDaysData] = useState<DayData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [modality, setModality] = useState<"PRESENCIAL" | "VIRTUAL">("VIRTUAL");

  // Datos del perfil profesional cargados de la API
  const [profile, setProfile] = useState<{
    sessionPrice: number;
    sessionDuration: number;
    allowPresencial: boolean;
    allowVirtual: boolean;
    fullName: string;
  } | null>(null);

  // Formulario del paciente
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(true);

  // Estados de carga y error
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resultado de reserva confirmada
  const [bookingResult, setBookingResult] = useState<{
    appointmentId: string;
    publicCode: string;
    token: string;
    expiresAt: string;
    price: number;
  } | null>(null);

  // Cargar disponibilidad para los 7 días de la semana actual
  useEffect(() => {
    async function loadWeek() {
      setLoadingWeek(true);
      setErrorMessage(null);

      const dateStrings: string[] = [];
      for (let i = 0; i < 7; i++) {
        dateStrings.push(format(addDays(currentWeekStart, i), "yyyy-MM-dd"));
      }

      try {
        const res = await fetch(`/api/availability?dates=${dateStrings.join(",")}`);
        const data = await res.json();
        if (data.success) {
          setWeekDaysData(data.days);
          if (data.profile) {
            setProfile(data.profile);
            if (!data.profile.allowPresencial && data.profile.allowVirtual) {
              setModality("VIRTUAL");
            }
          }

          // Auto-seleccionar primer día abierto con slots disponibles si no hay ninguno seleccionado
          const firstOpen = data.days.find(
            (d: DayData) => d.isOpen && d.slots.some((s) => s.available)
          );
          if (firstOpen) {
            setSelectedDate(firstOpen.date);
          } else {
            setSelectedDate(dateStrings[0]);
          }
        } else {
          setErrorMessage(data.error || "No se pudo cargar la agenda");
        }
      } catch (err) {
        setErrorMessage("Error de conexión al cargar la disponibilidad");
      } finally {
        setLoadingWeek(false);
      }
    }

    loadWeek();
  }, [currentWeekStart]);

  const handlePrevWeek = () => {
    const prev = addDays(currentWeekStart, -7);
    if (!isBefore(prev, startOfWeek(new Date(), { weekStartsOn: 1 }))) {
      setCurrentWeekStart(prev);
      setSelectedTime("");
    }
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
    setSelectedTime("");
  };

  const activeDay = weekDaysData.find((d) => d.date === selectedDate);
  const availableSlots = activeDay?.slots || [];

  const canProceedStep1 = selectedDate && selectedTime;

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceedStep1) {
      setErrorMessage("Por favor seleccioná un día y un horario disponible.");
      return;
    }
    setErrorMessage(null);
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || fullName.trim().length < 3) {
      setErrorMessage("Ingresá tu nombre y apellido completos.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Ingresá un correo electrónico válido para recibir la confirmación.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      setErrorMessage("Ingresá un número de teléfono de contacto.");
      return;
    }
    if (!privacyAccepted) {
      setErrorMessage("Es obligatorio aceptar el aviso de privacidad.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateStr: selectedDate,
          timeStr: selectedTime,
          modality,
          fullName,
          email,
          phone,
          privacyAccepted,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 409) {
          setErrorMessage(
            "¡El horario acaba de ser tomado por otra persona! Por favor volvé al paso 1 y elegí otro turno."
          );
          setStep(1);
          setSelectedTime("");
        } else {
          setErrorMessage(data.error || "No se pudo procesar la reserva. Intentá de nuevo.");
        }
        return;
      }

      setBookingResult(data.data);
      setStep(3);
    } catch (err) {
      setErrorMessage("Error de red al registrar la reserva.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Encabezado del asistente */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-sage-950 sm:text-3xl">
          Reservar Turno
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Completá los pasos para agendar tu sesión de manera rápida y segura.
        </p>

        {/* Indicador de pasos */}
        <div className="mx-auto mt-6 flex max-w-md items-center justify-between">
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              step >= 1 ? "text-sage-700" : "text-gray-400"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                step >= 1 ? "bg-sage-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              1
            </span>
            <span>Turno</span>
          </div>

          <div className={`h-0.5 flex-1 mx-2 ${step >= 2 ? "bg-sage-600" : "bg-gray-200"}`} />

          <div
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              step >= 2 ? "text-sage-700" : "text-gray-400"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                step >= 2 ? "bg-sage-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              2
            </span>
            <span>Tus Datos</span>
          </div>

          <div className={`h-0.5 flex-1 mx-2 ${step >= 3 ? "bg-sage-600" : "bg-gray-200"}`} />

          <div
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              step === 3 ? "text-sage-700" : "text-gray-400"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                step === 3 ? "bg-sage-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              3
            </span>
            <span>Confirmación</span>
          </div>
        </div>
      </div>

      {/* Alerta de error si ocurre */}
      {errorMessage && (
        <div className="mt-6 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 1: SELECCIÓN DE TURNO Y MODALIDAD */}
      {/* ========================================================================= */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="mt-8 space-y-8">
          {/* Selector de Modalidad */}
          <div className="rounded-2xl border border-warm-200 bg-white p-5 shadow-xs">
            <label className="block text-sm font-semibold text-gray-900">
              1. Modalidad de atención
            </label>

            {profile && !profile.allowPresencial ? (
              <div className="mt-3 flex items-center gap-3.5 rounded-xl border border-sage-600 bg-sage-50/70 p-4 ring-1 ring-sage-600">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-600 text-white">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900 block text-sm">
                    Atención 100% Virtual (Videollamada Online)
                  </span>
                  <span className="text-xs text-gray-600">
                    Las sesiones se llevan a cabo exclusivamente de forma online. Antes del turno recibirás el enlace para conectarte.
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setModality("PRESENCIAL")}
                  disabled={Boolean(profile && !profile.allowPresencial)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    modality === "PRESENCIAL"
                      ? "border-sage-600 bg-sage-50/70 ring-1 ring-sage-600"
                      : "border-gray-200 hover:border-gray-300"
                  } ${profile && !profile.allowPresencial ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      modality === "PRESENCIAL"
                        ? "bg-sage-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 block text-sm">
                      Atención Presencial
                    </span>
                    <span className="text-xs text-gray-500">
                      En consultorio particular
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setModality("VIRTUAL")}
                  disabled={Boolean(profile && !profile.allowVirtual)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    modality === "VIRTUAL"
                      ? "border-sage-600 bg-sage-50/70 ring-1 ring-sage-600"
                      : "border-gray-200 hover:border-gray-300"
                  } ${profile && !profile.allowVirtual ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      modality === "VIRTUAL"
                        ? "bg-sage-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900 block text-sm">
                      Atención Virtual
                    </span>
                    <span className="text-xs text-gray-500">
                      Videollamada online
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Navegador de Semanas y Calendario de Días */}
          <div className="rounded-2xl border border-warm-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <label className="text-sm font-semibold text-gray-900">
                2. Seleccioná el día
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevWeek}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  title="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="text-xs font-medium text-gray-600 sm:text-sm">
                  {format(currentWeekStart, "d 'de' MMM", { locale: es })} –{" "}
                  {format(addDays(currentWeekStart, 6), "d 'de' MMM yyyy", { locale: es })}
                </span>

                <button
                  type="button"
                  onClick={handleNextWeek}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  title="Semana siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Días de la semana */}
            <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDaysData.map((day) => {
                const dateObj = new Date(day.date + "T12:00:00");
                const isSelected = day.date === selectedDate;
                const hasSlots = day.isOpen && day.slots.some((s) => s.available);

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSelectedTime("");
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 text-center transition ${
                      isSelected
                        ? "bg-sage-600 text-white shadow-xs"
                        : hasSlots
                        ? "bg-warm-50 hover:bg-warm-100 text-gray-800"
                        : "bg-gray-50 text-gray-400 opacity-60"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold sm:text-xs">
                      {format(dateObj, "EEE", { locale: es })}
                    </span>
                    <span className="text-sm font-bold sm:text-lg">
                      {format(dateObj, "d")}
                    </span>
                    <span className="mt-0.5 text-[9px] sm:text-[10px]">
                      {hasSlots ? (
                        <span className={isSelected ? "text-sage-100" : "text-sage-700"}>
                          Libre
                        </span>
                      ) : (
                        <span>Cerrado</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Horarios disponibles del día seleccionado */}
            <div className="mt-6 border-t border-warm-200 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  3. Horarios disponibles ({selectedDate})
                </span>
                {profile && (
                  <span className="text-xs text-gray-500">
                    Duración: {profile.sessionDuration} minutos
                  </span>
                )}
              </div>

              {loadingWeek ? (
                <div className="flex h-32 items-center justify-center text-sm text-gray-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-sage-600" />
                  Cargando agenda...
                </div>
              ) : !activeDay?.isOpen ? (
                <div className="mt-4 rounded-xl bg-warm-50 p-6 text-center text-sm text-gray-600">
                  {activeDay?.closedReason || "No hay atención profesional para la fecha elegida."}
                </div>
              ) : availableSlots.filter((s) => s.available).length === 0 ? (
                <div className="mt-4 rounded-xl bg-warm-50 p-6 text-center text-sm text-gray-600">
                  No quedan horarios libres para este día. Por favor seleccioná otra fecha.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`rounded-xl border py-2.5 px-3 text-center text-sm font-semibold transition ${
                          isSelected
                            ? "border-sage-600 bg-sage-600 text-white shadow-xs"
                            : slot.available
                            ? "border-gray-200 bg-white hover:border-sage-500 hover:bg-sage-50/50 text-gray-800"
                            : "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canProceedStep1}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition ${
                canProceedStep1
                  ? "bg-violet-700 hover:bg-violet-800 active:scale-95"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <span>Continuar con mis datos</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* PASO 2: INGRESO DE DATOS PERSONALES */}
      {/* ========================================================================= */}
      {step === 2 && (
        <form onSubmit={handleStep2Submit} className="mt-8 space-y-6">
          <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="text-lg font-bold text-gray-900">Tus datos de contacto</h2>
            <p className="mt-1 text-xs text-gray-500">
              Solo solicitamos la información imprescindible para contactarte y coordinar la sesión.
            </p>

            {/* Resumen del turno seleccionado */}
            <div className="mt-4 rounded-xl bg-warm-50 p-4 text-xs sm:text-sm">
              <span className="font-semibold text-sage-900">Resumen de la sesión seleccionada:</span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-gray-700">
                <div>
                  <span className="text-gray-500">Fecha:</span> {selectedDate}
                </div>
                <div>
                  <span className="text-gray-500">Horario:</span> {selectedTime} hs
                </div>
                <div>
                  <span className="text-gray-500">Modalidad:</span>{" "}
                  {modality === "PRESENCIAL" ? "Presencial" : "Virtual"}
                </div>
                {profile && (
                  <div>
                    <span className="text-gray-500">Importe:</span> $
                    {profile.sessionPrice.toLocaleString("es-AR")}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Laura Martínez"
                  className="mt-1 block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 shadow-xs focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="mt-1 block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 shadow-xs focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
                />
                <span className="mt-1 block text-[11px] text-gray-400">
                  Enviaremos a esta casilla el enlace seguro de acceso y los comprobantes.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: +54 9 11 1234-5678"
                  className="mt-1 block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 shadow-xs focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
                />
              </div>

              {/* Consentimiento de Privacidad */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  <span className="text-xs text-gray-600">
                    Acepto el tratamiento confidencial de mis datos de contacto conforme a la Ley N°
                    25.326 y las políticas de privacidad del consultorio.
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Volver a horarios
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 active:scale-95 disabled:bg-gray-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando reserva...</span>
                </>
              ) : (
                <>
                  <span>Confirmar reserva</span>
                  <CheckCircle2 className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* PASO 3: CONFIRMACIÓN Y ENLACE DE ACCESO */}
      {/* ========================================================================= */}
      {step === 3 && bookingResult && (
        <div className="mt-8 rounded-2xl border border-warm-200 bg-white p-6 shadow-xs sm:p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-sage-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            ¡Tu solicitud de turno fue registrada!
          </h2>

          <p className="mt-2 text-sm text-gray-600 max-w-lg mx-auto">
            Guardamos tu lugar temporalmente. Para confirmar la sesión de forma definitiva, realizá
            la transferencia bancaria y adjuntá tu comprobante.
          </p>

          <div className="mx-auto mt-6 max-w-md rounded-2xl bg-warm-50 p-5 text-left text-xs sm:text-sm">
            <div className="space-y-2">
              <div className="flex justify-between border-b border-warm-200 pb-2">
                <span className="text-gray-500">Código de turno:</span>
                <span className="font-mono font-bold text-sage-900">
                  {bookingResult.publicCode}
                </span>
              </div>
              <div className="flex justify-between border-b border-warm-200 pb-2">
                <span className="text-gray-500">Fecha y horario:</span>
                <span className="font-semibold text-gray-900">
                  {selectedDate} a las {selectedTime} hs
                </span>
              </div>
              <div className="flex justify-between border-b border-warm-200 pb-2">
                <span className="text-gray-500">Modalidad:</span>
                <span className="font-semibold text-gray-900">
                  {modality === "PRESENCIAL" ? "Presencial en consultorio" : "Atención virtual"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Importe a transferir:</span>
                <span className="text-base font-bold text-sage-900">
                  ${bookingResult.price.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => router.push(`/turno/${bookingResult.token}`)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 py-3.5 text-base font-semibold text-white shadow-md hover:bg-violet-800 sm:w-auto"
            >
              <CreditCard className="h-5 w-5" />
              <span>Ver mi turno y adjuntar comprobante</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            También te enviamos un correo electrónico con este enlace directo de acceso.
          </p>
        </div>
      )}
    </div>
  );
}
