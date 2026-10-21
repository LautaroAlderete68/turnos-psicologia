import Link from "next/link";
import {
  Calendar,
  Clock,
  ShieldCheck,
  Video,
  MapPin,
  CreditCard,
  CheckCircle2,
  Phone,
  Mail,
  ArrowRight,
  FileText,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { SESSION_PRICE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let profile = null;
  try {
    profile = await prisma.psychologistProfile.findFirst();
  } catch (error) {
    console.error("Error al obtener perfil del psicólogo:", error);
  }

  const fullName = profile?.fullName || "Lic. Marisa Ebhardt";
  const license = profile?.license || "Matrícula Profesional";
  const specialty = profile?.specialty || "Psicología Clínica";
  const bio =
    profile?.bio ||
    "Atención psicológica profesional y confidencial. Un espacio de escucha cálido y empático para acompañarte en tu bienestar emocional.";
  const address = profile?.address || "Consultorio profesional";
  const phone = profile?.phone || "Consultar por mensaje";
  const email = profile?.email || "consultorio@psicologia.com";
  const price = SESSION_PRICE;
  const duration = profile?.sessionDuration ?? 50;
  const allowPresencial = profile?.allowPresencial ?? true;
  const allowVirtual = profile?.allowVirtual ?? true;
  const bankAlias = profile?.bankAlias || "CONSULTORIO.PSICO";
  const bankCbu = profile?.bankCbu || "0000000000000000000000";
  const bankName = profile?.bankName || "Banco";
  const paymentInstructions =
    profile?.paymentInstructions ||
    "Para asegurar tu turno, transferí el valor de la sesión al CBU o Alias indicado y adjuntá el comprobante emitido por tu banco.";
  const cancellationPolicy =
    profile?.cancellationPolicy ||
    "Los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de antelación.";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Sección Hero de Bienvenida */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sage-50 to-warm-100 p-8 text-center sm:p-14">
        <div className="mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-200/70 px-3 py-1 text-xs font-semibold text-sage-800">
            <ShieldCheck className="h-4 w-4" />
            Atención Profesional y Confidencial
          </span>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-sage-950 sm:text-5xl">
            {fullName}
          </h1>

          <p className="mt-2 text-sm font-medium text-sage-700 sm:text-base">
            {license} • {specialty}
          </p>

          <p className="mt-4 text-base leading-relaxed text-gray-700 sm:text-lg">
            {bio}
          </p>

          {/* Tarjeta de honorario y duración */}
          <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:gap-8 sm:px-8">
            <div className="text-center">
              <span className="text-xs uppercase tracking-wider text-gray-500">Valor de sesión</span>
              <p className="text-2xl font-bold text-sage-900 sm:text-3xl">
                ${price.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="h-8 w-px bg-warm-200" />
            <div className="text-center">
              <span className="text-xs uppercase tracking-wider text-gray-500">Duración</span>
              <p className="flex items-center justify-center gap-1 text-lg font-semibold text-gray-800 sm:text-xl">
                <Clock className="h-4 w-4 text-sage-600" />
                {duration} min
              </p>
            </div>
            <div className="h-8 w-px bg-warm-200" />
            <div className="text-center">
              <span className="text-xs uppercase tracking-wider text-gray-500">Modalidades</span>
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-800">
                {allowPresencial && (
                  <span className="flex items-center gap-0.5 text-xs text-sage-800">
                    <MapPin className="h-3.5 w-3.5 text-sage-600" /> Presencial
                  </span>
                )}
                {allowPresencial && allowVirtual && <span>•</span>}
                {allowVirtual && (
                  <span className="flex items-center gap-0.5 text-xs text-sage-800">
                    <Video className="h-3.5 w-3.5 text-sage-600" /> Virtual
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/reservar"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sage-600 px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-sage-700 hover:shadow-lg active:scale-98 sm:w-auto"
            >
              <Calendar className="h-5 w-5" />
              <span>Reservar un turno</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo funciona el sistema de reservas */}
      <section className="mt-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-sage-950 sm:text-3xl">
            ¿Cómo reservar tu sesión?
          </h2>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            El proceso es sencillo, rápido y 100% digital.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100 font-bold text-sage-800">
              1
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">Elegí tu fecha y horario</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Explorá la agenda en tiempo real y seleccioná el día y horario que mejor se adapte a tu rutina.
            </p>
          </div>

          <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100 font-bold text-sage-800">
              2
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">Ingresá tus datos de contacto</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Completá tu nombre, teléfono y correo electrónico. No solicitamos datos clínicos ni antecedentes.
            </p>
          </div>

          <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100 font-bold text-sage-800">
              3
            </div>
            <h3 className="mt-4 font-semibold text-gray-900">Transferí y adjuntá comprobante</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Recibirás un enlace seguro para subir tu comprobante de pago. La profesional confirmará tu turno a la brevedad.
            </p>
          </div>
        </div>
      </section>

      {/* Información de Medios de Pago y Políticas */}
      <section className="mt-16 grid gap-6 md:grid-cols-2">
        {/* Medios de Pago */}
        <div className="rounded-2xl border border-warm-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2 text-sage-800">
            <CreditCard className="h-5 w-5" />
            <h3 className="text-lg font-bold">Medios de Pago e Instrucciones</h3>
          </div>
          <p className="mt-3 text-sm text-gray-600">{paymentInstructions}</p>

          <div className="mt-6 rounded-xl bg-warm-50 p-4 text-xs sm:text-sm">
            <div className="grid gap-2">
              <div>
                <span className="font-medium text-gray-500">Banco:</span>{" "}
                <span className="font-semibold text-gray-900">{bankName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Alias:</span>{" "}
                <span className="font-mono font-bold text-sage-900">{bankAlias}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">CBU / CVU:</span>{" "}
                <span className="font-mono text-gray-800">{bankCbu}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Políticas y Contacto */}
        <div className="flex flex-col justify-between rounded-2xl border border-warm-200 bg-white p-6 sm:p-8">
          <div>
            <div className="flex items-center gap-2 text-sage-800">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="text-lg font-bold">Políticas del Consultorio</h3>
            </div>
            <p className="mt-3 text-sm text-gray-600">{cancellationPolicy}</p>

            <div className="mt-6 border-t border-warm-200 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Información de Contacto
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-sage-600" />
                  <span>{address}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-sage-600" />
                  <span>{phone}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-sage-600" />
                  <span>{email}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 border-t border-warm-200 pt-4">
            <Link
              href="/privacidad"
              className="inline-flex items-center gap-1.5 text-xs text-sage-700 hover:text-sage-900 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Consultar aviso de privacidad y protección de datos</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

