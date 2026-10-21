import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed de la base de datos...");

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@consultorio.com";
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "AdminSegura2026!";
  const adminName = process.env.INITIAL_ADMIN_NAME || "Lic. Marisa Ebhardt";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash: passwordHash,
      role: "ADMIN",
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash: passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Usuario administrador creado/actualizado: ${adminUser.email}`);

  // Perfil profesional de la psicóloga
  await prisma.psychologistProfile.upsert({
    where: { userId: adminUser.id },
    update: {
      allowPresencial: false,
      allowVirtual: true,
    },
    create: {
      userId: adminUser.id,
      fullName: "Lic. Marisa Ebhardt",
      license: "M.N. 48.912 / M.P. 24.105",
      specialty: "Psicología Clínica de Adultos y Parejas",
      bio: "Especialista en terapia cognitiva conductual (TCC) y mindfulness. Brindo un espacio de escucha cálido, profesional y libre de juicios para acompañarte en tu proceso personal.",
      phone: "+54 9 11 4050-6070",
      email: "consultas@marisaebhardt.com",
      address: "Atención Online / Videollamada",
      allowPresencial: false,
      allowVirtual: true,
      sessionPrice: 30000,
      sessionDuration: 50,
      bufferMinutes: 10,
      minNoticeHours: 4,
      maxAdvanceDays: 30,
      pendingExpirationMinutes: 120,
      bankAccountHolder: "Marisa Ebhardt",
      bankName: "Banco Santander Argentina",
      bankCbu: "0720123988000034567890",
      bankAlias: "MARISA.EBHARDT.PSICO",
      paymentInstructions: "Para asegurar tu turno, transferí el valor de la sesión al CBU o Alias indicado dentro de las 2 horas de haber reservado. Luego adjuntá el comprobante emitido por tu banco en esta plataforma.",
      cancellationPolicy: "Las cancelaciones o pedidos de reprogramación deben realizarse con al menos 24 horas de antelación. Pasado ese plazo, la sesión se considerará efectuada.",
      privacyNotice: "Toda la información suministrada se procesa con estricto secreto profesional y protección de datos personales conforme a la Ley Nacional N° 25.326.",
    },
  });

  console.log("Perfil profesional configurado.");

  // Horarios semanales habituales: Lunes a Viernes de 09:00 a 19:00 con pausa 13:00 a 14:00
  const days = [
    { dayOfWeek: 0, isActive: false, startTime: "09:00", endTime: "18:00" }, // Domingo
    { dayOfWeek: 1, isActive: true, startTime: "09:00", endTime: "19:00", breakStartTime: "13:00", breakEndTime: "14:00" }, // Lunes
    { dayOfWeek: 2, isActive: true, startTime: "09:00", endTime: "19:00", breakStartTime: "13:00", breakEndTime: "14:00" }, // Martes
    { dayOfWeek: 3, isActive: true, startTime: "09:00", endTime: "19:00", breakStartTime: "13:00", breakEndTime: "14:00" }, // Miércoles
    { dayOfWeek: 4, isActive: true, startTime: "09:00", endTime: "19:00", breakStartTime: "13:00", breakEndTime: "14:00" }, // Jueves
    { dayOfWeek: 5, isActive: true, startTime: "09:00", endTime: "17:00", breakStartTime: "13:00", breakEndTime: "14:00" }, // Viernes
    { dayOfWeek: 6, isActive: false, startTime: "09:00", endTime: "14:00" }, // Sábado
  ];

  for (const day of days) {
    await prisma.weeklySchedule.upsert({
      where: { dayOfWeek: day.dayOfWeek },
      update: {
        isActive: day.isActive,
        startTime: day.startTime,
        endTime: day.endTime,
        breakStartTime: day.breakStartTime || null,
        breakEndTime: day.breakEndTime || null,
      },
      create: {
        dayOfWeek: day.dayOfWeek,
        isActive: day.isActive,
        startTime: day.startTime,
        endTime: day.endTime,
        breakStartTime: day.breakStartTime || null,
        breakEndTime: day.breakEndTime || null,
      },
    });
  }

  console.log("Horarios semanales configurados (Lunes a Viernes).");
  console.log("Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
