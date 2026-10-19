"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Mail,
  KeyRound,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
} from "lucide-react";

export default function ConsultarTurnoPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [publicCode, setPublicCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSentMessage, setEmailSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailSentMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/patient/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          publicCode: publicCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "No pudimos localizar el turno con los datos ingresados.");
        return;
      }

      // Si ingresó código válido + email, redirigir directamente
      if (data.directAccess && data.token) {
        router.push(`/turno/${data.token}`);
        return;
      }

      // Si solo ingresó email, se envió enlace a su casilla
      setEmailSentMessage(
        "¡Listo! Si tenés un turno registrado con ese correo, te enviamos el enlace de acceso directo a tu bandeja de entrada."
      );
    } catch {
      setError("Error de red al consultar el turno.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sage-700 hover:text-sage-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Volver al inicio</span>
      </Link>

      <div className="rounded-3xl border border-warm-200 bg-white p-6 shadow-xs sm:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-sage-800">
            <Search className="h-6 w-6" />
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            Consultar mi Turno
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Ingresá tu correo electrónico para acceder al estado de tu turno o adjuntar tu
            comprobante de pago.
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-800 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {emailSentMessage && (
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-green-50 p-4 text-xs text-green-900 border border-green-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <span>{emailSentMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase">
              Correo Electrónico con el que reservaste *
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="block w-full rounded-xl border border-gray-200 pl-10 pr-3.5 py-2.5 text-sm text-gray-900 shadow-xs focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 uppercase">
                Código del Turno (Opcional)
              </label>
              <span className="text-[11px] text-gray-400">Ej: TRN-K89A2F</span>
            </div>
            <div className="relative mt-1">
              <KeyRound className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={publicCode}
                onChange={(e) => setPublicCode(e.target.value.toUpperCase())}
                placeholder="TRN-XXXXXX"
                className="block w-full rounded-xl border border-gray-200 pl-10 pr-3.5 py-2.5 text-sm font-mono text-gray-900 shadow-xs focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600 uppercase"
              />
            </div>
            <span className="mt-1 block text-[11px] text-gray-400">
              Si ingresás el código y tu correo, accederás directamente a la pantalla de tu turno.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sage-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sage-700 active:scale-98 disabled:bg-gray-400 transition"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <span>Acceder a mi turno</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-warm-200 pt-5 text-center">
          <p className="text-xs text-gray-500">¿Todavía no tenés un turno reservado?</p>
          <Link
            href="/reservar"
            className="mt-2 inline-flex items-center gap-1.5 font-semibold text-xs text-sage-700 hover:text-sage-900"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Consultar disponibilidad y agendar</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
