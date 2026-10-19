"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Credenciales incorrectas.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión al servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-warm-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-sage-800">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            Panel de la Profesional
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Ingreso protegido para la gestión de turnos, agenda y comprobantes.
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-800 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase">
              Correo Electrónico
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lic.consultorio@gmail.com"
                className="block w-full rounded-xl border border-gray-200 pl-10 pr-3.5 py-2.5 text-sm text-gray-900 shadow-xs focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase">
              Contraseña
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full rounded-xl border border-gray-200 pl-10 pr-3.5 py-2.5 text-sm text-gray-900 shadow-xs focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sage-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sage-700 active:scale-98 disabled:bg-gray-400"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Ingresando...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-warm-200 pt-4 text-center">
          <span className="flex items-center justify-center gap-1 text-[11px] text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-sage-600" />
            Acceso seguro con cifrado y cookies de sesión HttpOnly
          </span>
        </div>
      </div>
    </div>
  );
}
