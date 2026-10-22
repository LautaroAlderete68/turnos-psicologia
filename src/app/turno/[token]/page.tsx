import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { validatePatientToken } from "@/lib/patient-auth";
import { formatDateTimeArgentina, formatDateDDMMAAAA, formatTime24h } from "@/lib/timezone";
import PatientPortalClient from "./portal-client";

export const dynamic = "force-dynamic";

export default async function TurnoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const appointment = await validatePatientToken(token);
  if (!appointment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-900">
          <h1 className="text-xl font-bold">Enlace no válido o expirado</h1>
          <p className="mt-2 text-sm text-red-700">
            El enlace de acceso que utilizaste es incorrecto o ha superado su período de validez por
            motivos de seguridad y privacidad.
          </p>
          <a
            href="/reservar"
            className="mt-6 inline-block rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
          >
            Solicitar un nuevo turno
          </a>
        </div>
      </div>
    );
  }

  let profile = null;
  try {
    profile = await prisma.psychologistProfile.findFirst();
  } catch (error) {
    console.error("Error al obtener perfil en turno:", error);
  }

  return (
    <PatientPortalClient
      appointment={JSON.parse(JSON.stringify(appointment))}
      token={token}
      profile={JSON.parse(JSON.stringify(profile || {}))}
    />
  );
}
