import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  CreditCard,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-[90vh] flex-col md:flex-row bg-[#F8F9FA]">
      {/* Barra lateral de navegación administrativa */}
      <aside className="w-full md:w-64 shrink-0 border-r border-warm-200 bg-white p-4 sm:p-6 flex flex-col justify-between">
        <div>
          {/* Perfil del admin */}
          <div className="flex items-center gap-3 border-b border-warm-200 pb-5">
            <div
              role="img"
              aria-label="Símbolo de psicología con flores delicadas"
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage-800"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                className="absolute inset-0 h-full w-full"
                fill="none"
              >
                <path
                  d="M19 41C10 38 7 29 10 18M29 41C38 38 41 29 38 18"
                  stroke="#7D9275"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
                <g fill="#A3B49A">
                  <ellipse cx="10" cy="31" rx="1.5" ry="3.5" transform="rotate(-40 10 31)" />
                  <ellipse cx="15" cy="36" rx="1.4" ry="3" transform="rotate(35 15 36)" />
                  <ellipse cx="38" cy="31" rx="1.5" ry="3.5" transform="rotate(40 38 31)" />
                  <ellipse cx="33" cy="36" rx="1.4" ry="3" transform="rotate(-35 33 36)" />
                </g>
                <g fill="#E6BCC7">
                  <ellipse cx="10" cy="14" rx="1.8" ry="2.6" />
                  <ellipse cx="7.5" cy="16" rx="2.6" ry="1.8" transform="rotate(30 7.5 16)" />
                  <ellipse cx="8.5" cy="19" rx="1.8" ry="2.6" transform="rotate(30 8.5 19)" />
                  <ellipse cx="11.5" cy="19" rx="1.8" ry="2.6" transform="rotate(-30 11.5 19)" />
                  <ellipse cx="12.5" cy="16" rx="2.6" ry="1.8" transform="rotate(-30 12.5 16)" />
                </g>
                <g fill="#EAD5DC">
                  <ellipse cx="38" cy="14" rx="1.8" ry="2.6" />
                  <ellipse cx="35.5" cy="16" rx="2.6" ry="1.8" transform="rotate(30 35.5 16)" />
                  <ellipse cx="36.5" cy="19" rx="1.8" ry="2.6" transform="rotate(30 36.5 19)" />
                  <ellipse cx="39.5" cy="19" rx="1.8" ry="2.6" transform="rotate(-30 39.5 19)" />
                  <ellipse cx="40.5" cy="16" rx="2.6" ry="1.8" transform="rotate(-30 40.5 16)" />
                </g>
                <g fill="#C3A36A">
                  <circle cx="10" cy="17" r="1.4" />
                  <circle cx="38" cy="17" r="1.4" />
                </g>
              </svg>
              <span aria-hidden="true" className="relative font-serif text-3xl font-bold leading-none">Ψ</span>
            </div>
            <div className="truncate">
              <span className="block font-bold text-gray-900 text-sm truncate">
                {session.name}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-sage-700">
                <ShieldCheck className="h-3 w-3" /> Panel Administrativo
              </span>
            </div>
          </div>

          {/* Menú de navegación */}
          <nav className="mt-6 space-y-1 text-sm font-medium">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-gray-700 hover:bg-sage-50 hover:text-sage-900 transition"
            >
              <LayoutDashboard className="h-4 w-4 text-sage-600" />
              <span>Resumen</span>
            </Link>

            <Link
              href="/admin/calendario"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-gray-700 hover:bg-sage-50 hover:text-sage-900 transition"
            >
              <Calendar className="h-4 w-4 text-sage-600" />
              <span>Calendario y Agenda</span>
            </Link>

            <Link
              href="/admin/reservas"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-gray-700 hover:bg-sage-50 hover:text-sage-900 transition"
            >
              <BookOpen className="h-4 w-4 text-sage-600" />
              <span>Gestión de Turnos</span>
            </Link>

            <Link
              href="/admin/pagos"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-gray-700 hover:bg-sage-50 hover:text-sage-900 transition"
            >
              <CreditCard className="h-4 w-4 text-sage-600" />
              <span>Comprobantes y Pagos</span>
            </Link>

            <Link
              href="/admin/configuracion"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-gray-700 hover:bg-sage-50 hover:text-sage-900 transition"
            >
              <Settings className="h-4 w-4 text-sage-600" />
              <span>Configuración</span>
            </Link>
          </nav>
        </div>

        {/* Botón de Salir */}
        <div className="pt-6 border-t border-warm-200 mt-6">
          <form action="/api/admin/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido principal del dashboard */}
      <main className="flex-1 p-4 sm:p-8 overflow-x-auto">{children}</main>
    </div>
  );
}
