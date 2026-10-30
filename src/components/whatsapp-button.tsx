"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

interface FloatingWhatsAppProps {
  phone?: string | null;
}

export function FloatingWhatsApp({ phone }: FloatingWhatsAppProps) {
  const pathname = usePathname();

  // Ocultar en el panel de administración para no tapar controles
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  // Sanitizar número para formato WhatsApp internacional
  const rawPhone = phone || "+54 9 11 5555-5555";
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length >= 12) {
    digits = "549" + digits.slice(2);
  } else if (!digits.startsWith("54") && digits.length === 10) {
    // Si sólo ingresaron código de área + número sin país (ej: 1155555555)
    digits = "549" + digits;
  }

  const defaultMessage = encodeURIComponent(
    "Hola Licenciada, me comunico desde la plataforma de turnos para realizar una consulta."
  );
  const waUrl = `https://wa.me/${digits}?text=${defaultMessage}`;

  return (
    <aside aria-label="Contacto por WhatsApp" className="fixed bottom-6 right-6 z-40 group">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="flex items-center gap-2.5 rounded-full bg-rose-600 px-4 py-3 text-white shadow-lg transition-all duration-300 hover:bg-rose-700 hover:shadow-xl hover:scale-105 active:scale-95 border border-rose-500/30"
      >
        {/* Ícono oficial de WhatsApp SVG */}
        <svg
          className="h-6 w-6 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.507 14.307l-.009.075c-.236-.12-1.393-.688-1.61-.766-.216-.079-.374-.12-.532.12-.157.24-.61.766-.748.923-.138.158-.276.177-.512.06-.237-.12-1.002-.37-1.908-1.178-.706-.628-1.183-1.405-1.321-1.642-.138-.237-.015-.365.104-.483.107-.107.237-.277.355-.415.118-.14.158-.238.237-.396.079-.158.04-.297-.02-.416-.06-.119-.533-1.284-.73-1.76-.193-.464-.388-.401-.533-.408-.138-.007-.296-.009-.455-.009-.158 0-.415.06-.632.297-.217.237-.83.811-.83 1.977 0 1.167.85 2.294.968 2.452.119.158 1.674 2.556 4.055 3.583.566.244 1.009.39 1.354.5.568.181 1.085.155 1.493.094.455-.068 1.394-.57 1.59-1.121.198-.552.198-1.026.139-1.122-.06-.095-.218-.154-.455-.273zM12.04 2C6.52 2 2.03 6.488 2.03 12.008c0 1.87.518 3.62 1.417 5.126L2 22l5.02-1.316a9.96 9.96 0 0 0 5.02 1.332h.005c5.518 0 10.007-4.489 10.007-10.008 0-2.673-1.04-5.187-2.932-7.078A9.94 9.94 0 0 0 12.04 2zm0 18.257h-.004a8.27 8.27 0 0 1-4.22-1.157l-.303-.18-3.136.822.837-3.056-.197-.314a8.267 8.267 0 0 1-1.267-4.364c0-4.57 3.719-8.288 8.29-8.288 2.214 0 4.296.863 5.861 2.43 1.566 1.566 2.428 3.649 2.427 5.864 0 4.57-3.718 8.289-8.287 8.289z" />
        </svg>
        <span className="hidden text-sm font-semibold sm:inline-block">
          ¿Dudas? Escribinos
        </span>
      </a>
    </aside>
  );
}
