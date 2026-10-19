import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { addDays, format, subDays } from "date-fns";
import prisma from "../src/lib/prisma";
import { AvailabilityService } from "../src/lib/services/availability.service";
import { AppointmentService, SlotUnavailableError } from "../src/lib/services/appointment.service";
import { PaymentService } from "../src/lib/services/payment.service";
import { validateFileMagicBytes } from "../src/lib/services/storage.service";
import { validatePatientToken } from "../src/lib/patient-auth";
import { verifyAdminToken, createAdminToken } from "../src/lib/auth";
import { getArgentinaDateString, argentinaTimeToUtc } from "../src/lib/timezone";

describe("Flujos Críticos Obligatorios del Sistema de Turnos", () => {
  let testDateStr: string;
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const fakeExeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ executable

  beforeAll(async () => {
    // Buscar un día de semana futuro (ej. dentro de 7 días, asegurando Lunes a Jueves)
    let candidate = addDays(new Date(), 7);
    while (candidate.getDay() === 0 || candidate.getDay() === 6) {
      candidate = addDays(candidate, 1);
    }
    testDateStr = format(candidate, "yyyy-MM-dd");

    // Limpiar reservas y bloqueos para la fecha de prueba
    const startUtc = argentinaTimeToUtc(testDateStr, "00:00");
    const endUtc = argentinaTimeToUtc(testDateStr, "23:59");

    await prisma.appointment.deleteMany({
      where: {
        startTime: { gte: startUtc, lte: endUtc },
      },
    });
    await prisma.scheduleBlock.deleteMany({
      where: {
        startTime: { gte: startUtc, lte: endUtc },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // 1. Un paciente puede consultar disponibilidad
  it("1. Un paciente puede consultar disponibilidad", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    expect(availability).toBeDefined();
    expect(availability.date).toBe(testDateStr);
    expect(availability.isOpen).toBe(true);
    expect(availability.slots.length).toBeGreaterThan(0);

    const firstAvailableSlot = availability.slots.find((s) => s.available);
    expect(firstAvailableSlot).toBeDefined();
    expect(firstAvailableSlot?.time).toMatch(/^\d{2}:\d{2}$/);
  });

  // 2. Un paciente puede solicitar un turno disponible
  it("2. Un paciente puede solicitar un turno disponible", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    const availableSlot = availability.slots.find((s) => s.available);
    expect(availableSlot).toBeDefined();

    const result = await AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: availableSlot!.time,
      modality: "VIRTUAL",
      fullName: "Ana García",
      email: "anagarcia@test.com",
      phone: "+54 11 9999-1111",
      privacyAccepted: true,
    });

    expect(result).toBeDefined();
    expect(result.appointmentId).toBeDefined();
    expect(result.publicCode).toMatch(/^TRN-[A-Z0-9]{6}$/);
    expect(result.token).toBeDefined();

    // Comprobar estado en base de datos
    const app = await prisma.appointment.findUnique({
      where: { id: result.appointmentId },
      include: { payment: true },
    });
    expect(app?.status).toBe("PENDIENTE_PAGO");
    expect(app?.payment?.status).toBe("PENDIENTE");
  });

  // 3. Dos solicitudes simultáneas no pueden reservar el mismo horario
  it("3. Dos solicitudes simultáneas no pueden reservar el mismo horario", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    // Elegimos el último slot disponible del día para evitar conflicto con el test 2
    const freeSlots = availability.slots.filter((s) => s.available);
    const targetSlot = freeSlots[freeSlots.length - 1];
    expect(targetSlot).toBeDefined();

    const req1 = AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: targetSlot.time,
      modality: "PRESENCIAL",
      fullName: "Carlos Pérez",
      email: "carlos@test.com",
      phone: "+54 11 2222-3333",
      privacyAccepted: true,
    });

    const req2 = AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: targetSlot.time,
      modality: "VIRTUAL",
      fullName: "María González",
      email: "maria@test.com",
      phone: "+54 11 4444-5555",
      privacyAccepted: true,
    });

    const [res1, res2] = await Promise.allSettled([req1, req2]);

    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejections = [res1, res2].filter((r) => r.status === "rejected");

    // Exactamente una debe haber tenido éxito y la otra debe haber fallado
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    const error = (rejections[0] as PromiseRejectedResult).reason;
    expect(error.message).toMatch(/no se encuentra disponible|bloqueado/i);
  });

  // 4. No se puede reservar un horario bloqueado
  it("4. No se puede reservar un horario bloqueado", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    const freeSlot = availability.slots.find((s) => s.available);
    expect(freeSlot).toBeDefined();

    // Crear un bloqueo deliberado sobre este horario
    await prisma.scheduleBlock.create({
      data: {
        startTime: freeSlot!.startTimeUtc,
        endTime: freeSlot!.endTimeUtc,
        reason: "Reunión de supervisión clínica",
      },
    });

    // Intentar reservar debe fallar
    await expect(
      AppointmentService.createAppointment({
        dateStr: testDateStr,
        timeStr: freeSlot!.time,
        modality: "PRESENCIAL",
        fullName: "Roberto Díaz",
        email: "roberto@test.com",
        phone: "+54 11 5555-6666",
        privacyAccepted: true,
      })
    ).rejects.toThrow(/bloqueado/i);
  });

  // 5. No se puede reservar una fecha pasada
  it("5. No se puede reservar una fecha pasada", async () => {
    const pastDateStr = format(subDays(new Date(), 2), "yyyy-MM-dd");

    await expect(
      AppointmentService.createAppointment({
        dateStr: pastDateStr,
        timeStr: "10:00",
        modality: "PRESENCIAL",
        fullName: "Lucía Fernández",
        email: "lucia@test.com",
        phone: "+54 11 7777-8888",
        privacyAccepted: true,
      })
    ).rejects.toThrow(/pasad/i);
  });

  // 6. Un paciente no puede consultar las reservas de otra persona
  it("6. Un paciente no puede consultar las reservas de otra persona", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    const freeSlot = availability.slots.find((s) => s.available);
    expect(freeSlot).toBeDefined();

    const result = await AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: freeSlot!.time,
      modality: "VIRTUAL",
      fullName: "Tomás Blanco",
      email: "tomas@test.com",
      phone: "+54 11 8888-9999",
      privacyAccepted: true,
    });

    // Validar con su token real -> Debe devolver el turno
    const ownAppointment = await validatePatientToken(result.token);
    expect(ownAppointment).toBeDefined();
    expect(ownAppointment?.id).toBe(result.appointmentId);
    expect(ownAppointment?.patient.email).toBe("tomas@test.com");

    // Token forjado o inventado -> Debe devolver null (acceso denegado)
    const forgedToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const forbidden = await validatePatientToken(forgedToken);
    expect(forbidden).toBeNull();
  });

  // 7. Un paciente no puede acceder al panel administrativo
  it("7. Un paciente no puede acceder al panel administrativo", async () => {
    // Si se pasa un token inválido o de paciente a la verificación de administrador
    const invalidAdmin = await verifyAdminToken("token-falso-de-paciente-123456");
    expect(invalidAdmin).toBeNull();

    // Verificamos que solo un token legítimo firmado con rol ADMIN es aceptado
    const validAdminJwt = await createAdminToken({
      sub: "admin-1",
      email: "admin@consultorio.com",
      name: "Lic. Psicóloga",
      role: "ADMIN",
    });
    const validAdmin = await verifyAdminToken(validAdminJwt);
    expect(validAdmin).not.toBeNull();
    expect(validAdmin?.role).toBe("ADMIN");
  });

  // 8. Un comprobante inválido es rechazado
  it("8. Un comprobante inválido es rechazado", async () => {
    // Archivo con cabecera de ejecutable o texto arbitrario
    const validation = validateFileMagicBytes(fakeExeBuffer);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toMatch(/solo se aceptan archivos válidos/i);

    // Archivo PNG legítimo
    const pngValidation = validateFileMagicBytes(validPngBuffer);
    expect(pngValidation.isValid).toBe(true);
    expect(pngValidation.mimeType).toBe("image/png");

    // Validar rechazo a nivel servicio
    await expect(
      PaymentService.attachProof({
        appointmentId: "fake-id",
        buffer: fakeExeBuffer,
        originalFilename: "comprobante.exe",
      })
    ).rejects.toThrow(/solo se aceptan archivos válidos/i);
  });

  // 9. Un comprobante no es accesible sin autorización
  it("9. Un comprobante no es accesible sin autorización", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    const freeSlot = availability.slots.find((s) => s.available);
    expect(freeSlot).toBeDefined();

    const created = await AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: freeSlot!.time,
      modality: "VIRTUAL",
      fullName: "Florencia Paz",
      email: "florencia@test.com",
      phone: "+54 11 3333-2222",
      privacyAccepted: true,
    });

    const proof = await PaymentService.attachProof({
      appointmentId: created.appointmentId,
      buffer: validPngBuffer,
      originalFilename: "comprobante_banco.png",
    });

    // Paciente con su propio token -> Autorizado
    const authorizedForOwner = await PaymentService.canAccessProof(proof.proofId, {
      patientToken: created.token,
    });
    expect(authorizedForOwner).toBe(true);

    // Psicóloga / Administrador -> Autorizado
    const authorizedForAdmin = await PaymentService.canAccessProof(proof.proofId, {
      isAdmin: true,
    });
    expect(authorizedForAdmin).toBe(true);

    // Token incorrecto o de otro paciente -> DENEGADO
    const unauthorized = await PaymentService.canAccessProof(proof.proofId, {
      patientToken: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    expect(unauthorized).toBe(false);

    // Sin autorización -> DENEGADO
    const noAuth = await PaymentService.canAccessProof(proof.proofId, {});
    expect(noAuth).toBe(false);
  });

  // 10. Una reserva expirada libera el horario conforme a las reglas definidas
  it("10. Una reserva expirada libera el horario conforme a las reglas definidas", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    const freeSlot = availability.slots.find((s) => s.available);
    expect(freeSlot).toBeDefined();

    const created = await AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: freeSlot!.time,
      modality: "PRESENCIAL",
      fullName: "Esteban Morales",
      email: "esteban@test.com",
      phone: "+54 11 1234-5678",
      privacyAccepted: true,
    });

    // Forzamos manualmente la expiración en el pasado
    await prisma.appointment.update({
      where: { id: created.appointmentId },
      data: {
        expiresAt: subDays(new Date(), 1), // Venció ayer
      },
    });

    // Al limpiar o al verificar disponibilidad, el turno expirado se cancela y libera el horario
    const cleanedCount = await AppointmentService.cleanExpiredAppointments();
    expect(cleanedCount).toBeGreaterThanOrEqual(1);

    const refreshedApp = await prisma.appointment.findUnique({
      where: { id: created.appointmentId },
    });
    expect(refreshedApp?.status).toBe("CANCELADA");

    // Otro paciente ahora PUEDE reservar el horario que antes estaba ocupado
    const newBooking = await AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: freeSlot!.time,
      modality: "VIRTUAL",
      fullName: "Julieta Romero",
      email: "julieta@test.com",
      phone: "+54 11 9876-5432",
      privacyAccepted: true,
    });
    expect(newBooking.appointmentId).toBeDefined();
  });

  // 11. Un pago no se aprueba automáticamente al adjuntar un comprobante
  it("11. Un pago no se aprueba automáticamente al adjuntar un comprobante", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    const freeSlot = availability.slots.find((s) => s.available);
    expect(freeSlot).toBeDefined();

    const created = await AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: freeSlot!.time,
      modality: "VIRTUAL",
      fullName: "Martín Luna",
      email: "martin@test.com",
      phone: "+54 11 5432-1098",
      privacyAccepted: true,
    });

    // Paciente sube comprobante
    await PaymentService.attachProof({
      appointmentId: created.appointmentId,
      buffer: validPngBuffer,
      originalFilename: "transferencia_galicia.png",
    });

    const app = await prisma.appointment.findUnique({
      where: { id: created.appointmentId },
      include: { payment: true },
    });

    // Estados esperados: COMPROBANTE_ENVIADO / COMPROBANTE_RECIBIDO (NO CONFIRMADA ni APROBADO)
    expect(app?.status).toBe("COMPROBANTE_ENVIADO");
    expect(app?.payment?.status).toBe("COMPROBANTE_RECIBIDO");
    expect(app?.status).not.toBe("CONFIRMADA");
    expect(app?.payment?.status).not.toBe("APROBADO");
  });

  // 12. La aprobación o el rechazo del pago actualiza correctamente su estado
  it("12. La aprobación o el rechazo del pago actualiza correctamente su estado", async () => {
    const availability = await AvailabilityService.getSlotsForDate(testDateStr);
    const freeSlot = availability.slots.find((s) => s.available);
    expect(freeSlot).toBeDefined();

    const created = await AppointmentService.createAppointment({
      dateStr: testDateStr,
      timeStr: freeSlot!.time,
      modality: "PRESENCIAL",
      fullName: "Valeria Sosa",
      email: "valeria@test.com",
      phone: "+54 11 6789-0123",
      privacyAccepted: true,
    });

    await PaymentService.attachProof({
      appointmentId: created.appointmentId,
      buffer: validPngBuffer,
      originalFilename: "comprobante_banco.png",
    });

    const payment = await prisma.payment.findUnique({
      where: { appointmentId: created.appointmentId },
    });
    expect(payment).toBeDefined();

    // Caso A: Rechazo con motivo
    const rejectedPayment = await PaymentService.rejectPayment(
      payment!.id,
      "El comprobante no muestra el número de operación legible."
    );
    expect(rejectedPayment.status).toBe("RECHAZADO");
    expect(rejectedPayment.rejectionReason).toBe("El comprobante no muestra el número de operación legible.");
    expect(rejectedPayment.reviewedAt).toBeDefined();

    const appAfterReject = await prisma.appointment.findUnique({
      where: { id: created.appointmentId },
    });
    expect(appAfterReject?.status).toBe("PENDIENTE_PAGO"); // Permite al paciente reintentar

    // Caso B: Aprobación
    const approvedPayment = await PaymentService.approvePayment(payment!.id, "admin-1");
    expect(approvedPayment.status).toBe("APROBADO");
    expect(approvedPayment.rejectionReason).toBeNull();

    const appAfterApprove = await prisma.appointment.findUnique({
      where: { id: created.appointmentId },
    });
    expect(appAfterApprove?.status).toBe("CONFIRMADA");
  });
});
