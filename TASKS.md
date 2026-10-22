# Tareas Pendientes y Roadmap

## 🚀 Integraciones Planificadas

### [Issue #1](https://github.com/LautaroAlderete68/turnos-psicologia/issues/1): Automatización de Salas Virtuales (Google Meet / Zoom)

**Descripción:**  
Generación dinámica y automática de salas de videoconferencia cuando la profesional aprueba el pago de una sesión reservada en modalidad **Virtual**, enviando el enlace de conexión inmediatamente por correo al paciente.

#### Flujo de Funcionamiento:
1. **Aprobación de Pago:**  
   La psicóloga revisa y aprueba el comprobante desde el panel administrativo (`/admin/pagos`).
2. **Creación Automática:**  
   Si `appointment.modality === 'VIRTUAL'`, el servicio `MeetingService` conecta con la API de videoconferencias (Google Calendar / Google Meet o Zoom Server-to-Server OAuth) y programa la reunión para la fecha (`startTime`) y duración (`endTime`).
3. **Persistencia y Notificación:**  
   - Se guarda el enlace (`meetingUrl`) en el turno.
   - Se despacha el email transaccional al paciente con el botón directo para ingresar a la sala.
   - En el portal privado del paciente (`/turno/[token]`), se muestra el enlace directo de acceso a la sala.

#### Checklist Técnico:
- [ ] **Esquema de BD:** Agregar `meetingUrl String?` en el modelo `Appointment` (`prisma/schema.prisma`).
- [ ] **Servicio de Videollamadas:** Crear `src/lib/services/meeting.service.ts` con abstracción para Google Meet o Zoom.
- [ ] **Lógica en Endpoint:** Invocar la creación de la sala en `/api/admin/payments/approve`.
- [ ] **Plantilla de Correo:** Actualizar `sendPaymentApproved` en `src/lib/services/email.service.ts` para adjuntar el enlace de reunión.
- [ ] **Portal del Turno:** Mostrar botón de acceso interactivo en `src/app/turno/[token]/portal-client.tsx`.
- [ ] **Documentación:** Variables de entorno y credenciales en `.env.example` y `README.md`.
