import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PrivacidadPage() {
  let profile = null;
  try {
    profile = await prisma.psychologistProfile.findFirst();
  } catch (error) {
    console.error("Error al obtener perfil en privacidad:", error);
  }

  const customNotice =
    profile?.privacyNotice ||
    "El consultorio garantiza la confidencialidad de los datos personales suministrados de acuerdo con la Ley N° 25.326 de Protección de Datos Personales de la República Argentina.";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sage-700 hover:text-sage-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Volver al inicio</span>
      </Link>

      <div className="rounded-2xl border border-warm-200 bg-white p-6 shadow-xs sm:p-10">
        <div className="flex items-center gap-2.5 text-sage-800">
          <ShieldCheck className="h-6 w-6 text-sage-600" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Aviso de Privacidad y Protección de Datos Personales
          </h1>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700 border-t border-warm-200 pt-6">
          <p className="font-semibold text-gray-900">
            Marco normativo aplicable en la República Argentina (Ley Nacional N° 25.326)
          </p>

          <p>
            En cumplimiento de la Ley de Protección de Datos Personales N° 25.326 y sus normas
            complementarias, se informa a los pacientes y usuarios del consultorio que los datos
            personales recabados a través de esta plataforma (nombre y apellido, correo electrónico y
            número telefónico) son utilizados con la exclusiva finalidad de coordinar y gestionar los
            turnos de atención profesional y la verificación de las transferencias de pago.
          </p>

          <div className="rounded-xl bg-sage-50 p-4 border border-sage-200 text-xs text-sage-900">
            <p className="font-bold">Política del Consultorio:</p>
            <p className="mt-1">{customNotice}</p>
          </div>

          <h2 className="text-base font-bold text-gray-900 pt-2">
            1. Minimización de datos y ausencia de registros clínicos en la plataforma
          </h2>
          <p>
            Para resguardar el secreto profesional y la intimidad de las personas, este sistema
            restringe los datos solicitados al mínimo indispensable para el contacto administrativo.
            <strong>
              {" "}
              La plataforma no recopila, no solicita ni almacena diagnósticos médicos, motivos de
              consulta terapéutica, antecedentes clínicos ni registros de evolución psicológica.
            </strong>
          </p>

          <h2 className="text-base font-bold text-gray-900 pt-2">
            2. Confidencialidad y almacenamiento seguro
          </h2>
          <p>
            Los comprobantes de transferencia bancaria se resguardan en un espacio de almacenamiento
            privado y encriptado, fuera de directorios de acceso público. El acceso a los mismos está
            estrictamente restringido a la psicóloga titular y al paciente titular mediante enlaces
            criptográficamente autenticados.
          </p>

          <h2 className="text-base font-bold text-gray-900 pt-2">
            3. Derechos de acceso, rectificación y supresión (Derechos ARCO)
          </h2>
          <p>
            El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a
            los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se
            acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso
            3 de la Ley Nº 25.326. Para solicitar la actualización, rectificación o eliminación de sus
            datos de la agenda administrativa, puede comunicarse a los canales de contacto
            informados en el consultorio.
          </p>

          <p className="text-xs text-gray-500 pt-4 border-t border-warm-200">
            Nota de transparencia: Las presentes directrices reflejan las medidas de seguridad
            técnicas y organizativas adoptadas por el consultorio. Todo asesoramiento legal
            definitivo requiere de revisión profesional periódica.
          </p>
        </div>
      </div>
    </div>
  );
}
