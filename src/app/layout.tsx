import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Shield, HeartHandshake, User } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consultorio Psicológico | Turnos Online",
  description: "Plataforma de gestión y reserva de turnos online para atención psicológica presencial y virtual.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col bg-[#FBFBF9] text-gray-800 antialiased">
        {/* Barra superior de navegación */}
        <header className="sticky top-0 z-30 border-b border-warm-200 bg-[#FBFBF9]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-sage-800 transition hover:text-sage-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage-100 text-sage-700">
                <HeartHandshake className="h-5 w-5" />
              </span>
              <div>
                <span className="block text-sm font-semibold tracking-tight text-sage-900 sm:text-base">
                  Consultorio Psicológico
                </span>
                <span className="block text-xs text-gray-500">Gestión de Turnos</span>
              </div>
            </Link>

            <nav className="flex items-center gap-3 sm:gap-6">
              <Link
                href="/reservar"
                className="flex items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sage-700 active:scale-95"
              >
                <Calendar className="h-4 w-4" />
                <span>Reservar turno</span>
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-sage-800 sm:text-sm"
                title="Acceso exclusivo psicóloga"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Panel profesional</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Contenido principal */}
        <main className="flex-1">{children}</main>

        {/* Pie de página */}
        <footer className="mt-16 border-t border-warm-200 bg-warm-100 py-8 text-xs text-gray-600">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
              <div>
                <p className="font-medium text-gray-700">Consultorio de Psicología Clínica</p>
                <p className="mt-1 text-gray-500">
                  Atención presencial en consultorio y sesiones virtuales.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 text-gray-500">
                <Link href="/privacidad" className="hover:text-sage-700 hover:underline">
                  Aviso de privacidad (Ley 25.326)
                </Link>
                <span>•</span>
                <Link href="/admin" className="hover:text-sage-700 hover:underline">
                  Ingreso profesional
                </Link>
              </div>
            </div>

            <div className="mt-6 border-t border-warm-200 pt-4 text-center text-gray-400">
              © {new Date().getFullYear()} Consultorio Psicológico. Todos los derechos reservados.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
