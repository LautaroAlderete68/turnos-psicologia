# Turnos Psicología - Sistema Integral de Gestión de Turnos y Comprobantes

Aplicación web completa, moderna y segura para la reserva y gestión de turnos de un consultorio psicológico, con validación de transferencias bancarias y panel privado para la profesional.

Repositorio: **`LautaroAlderete68/turnos-psicologia`**  
Colaborador con acceso: **`GerardoLujanMolina`**

---

## 1. Características Principales

### Para los Pacientes
- **Consulta de disponibilidad en tiempo real**: Calendario semanal dinámico con cálculo automático de turnos libres, respetando horarios habituales, feriados, vacaciones y bloqueos de agenda.
- **Reserva en 3 pasos simples**: Selección de modalidad (Presencial o Virtual), ingreso de datos de contacto mínimos (sin DNI ni datos clínicos) y confirmación instantánea.
- **Prevención estricta de doble reserva**: Verificación transaccional en el servidor con bloqueos concurrentes; dos personas no pueden reservar el mismo turno simultáneamente.
- **Portal privado del turno con Enlaces Mágicos Criptográficos**: Acceso mediante tokens seguros de 256 bits (SHA-256) sin requerir contraseñas ni exponer identificadores correlativos.
- **Carga segura de comprobantes de pago**: Soporte para formatos JPG, PNG, WEBP y PDF con validación estricta por *Magic Bytes* (cabecera binaria) y límite de 10 MB.
- **Temporizador de vencimiento**: Liberación automática del horario si una reserva pendiente no es abonada dentro del plazo configurado (ej. 2 horas).
- **Copiar datos bancarios con un clic**: CBU/CVU y Alias listos para transferir con un toque.
- **Cancelación ágil**: Posibilidad de cancelar el turno informando el motivo y liberando la agenda.

### Para la Psicóloga (Panel Administrativo)
- **Dashboard de resumen**: Métricas de turnos de hoy, reservas pendientes, comprobantes por revisar, cobranzas del mes y cancelaciones.
- **Calendario interactivo**: Vista semanal con estados por colores, detalle de cada paciente y herramienta para **bloquear franjas horarias** (congresos, supervisión, imprevistos).
- **Gestión de turnos**: Listado con búsqueda reactiva por paciente, código o email, filtros por modalidad y estado, edición de estados y **registro de notas administrativas no clínicas**.
- **Bandeja de comprobantes y pagos**: Previsualización segura (imágenes y visor PDF integrado), aprobación en un clic con confirmación automática de turno, o rechazo con motivo obligatorio y notificación al paciente.
- **Configuración integral del consultorio**:
  - Perfil profesional, matrícula, bio, especialidad y datos de contacto.
  - Honorario por sesión, duración, buffer entre sesiones y modalidades activas.
  - Horarios semanales habituales por día (inicio, fin, pausa de almuerzo).
  - Plazos de anticipación mínima y máxima de reserva.
  - Datos bancarios (Banco, CBU, Alias, Titular) e instrucciones de transferencia.
  - Política de cancelación y aviso legal de privacidad (Ley 25.326).

---

## 2. Tecnologías y Arquitectura

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Components y Route Handlers) con TypeScript.
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/) con paleta cálida y profesional (verde salvia, beige arena, off-white).
- **Iconografía**: [Lucide React](https://lucide.dev/).
- **ORM & Base de Datos**: [Prisma ORM](https://www.prisma.io/) con esquema normalizado:
  - **Producción**: PostgreSQL nativo (`prisma/schema.postgresql.prisma`).
  - **Desarrollo / Tests**: SQLite local autocontenido sin dependencias externas (`prisma/schema.prisma`).
- **Autenticación**:
  - Psicóloga: Cookies `HttpOnly`, `SameSite=Lax`, seguras con tokens firmados vía `jose` y contraseñas hasheadas con `bcryptjs` (cost factor 12).
  - Pacientes: Tokens criptográficos generados con `crypto.randomBytes(32)` almacenados como hash SHA-256 en base de datos.
- **Almacenamiento de Comprobantes**: Módulo modular `StorageService`:
  - Almacenamiento local privado en carpeta protegida fuera de `public/`.
  - Endpoint de descarga `/api/proofs/[id]/download` con autorización obligatoria (solo psicóloga o paciente titular).
  - Listo para conectar con buckets privados S3, Cloudflare R2 o Supabase Storage.
- **Fechas y Horarios**: `date-fns` y `date-fns-tz` configurados para la zona horaria **`America/Argentina/Buenos_Aires`**, formato DD/MM/AAAA y horarios de 24 horas.
- **Protección**: Rate limiting en memoria para endpoints sensibles, cabeceras HTTP de seguridad (X-Frame-Options DENY, X-Content-Type nosniff, CSP).
- **Pruebas Automatizadas**: [Vitest](https://vitest.dev/) con suite de 12 pruebas obligatorias para todos los flujos críticos del sistema.

---

## 3. Instalación y Puesta en Marcha Local

### Requisitos Previos
- Node.js versión 18 o superior (v24 recomendada).
- npm o pnpm.

### Pasos de Instalación

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/LautaroAlderete68/turnos-psicologia.git
   cd turnos-psicologia
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

4. **Generar el cliente Prisma y sincronizar la base de datos**:
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

5. **Cargar los datos iniciales (Seed)**:
   ```bash
   npx tsx prisma/seed.ts
   ```
   Esto creará el perfil profesional por defecto y el usuario administrador inicial:
   - **Email**: `admin@consultorio.com`
   - **Contraseña**: `AdminSegura2026!`

6. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abrí [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 4. Ejecución de Pruebas Automatizadas

El proyecto cuenta con una suite integral de 12 pruebas automatizadas que verifican los flujos críticos del negocio:

```bash
npm run test
```

### Flujos Validados:
1. `test_01_patient_can_view_availability`: Consulta de disponibilidad y cálculo de slots libres.
2. `test_02_patient_can_request_available_slot`: Creación exitosa de reserva y asignación de token seguro.
3. `test_03_concurrent_requests_prevent_double_booking`: Dos pacientes intentando reservar el mismo horario exactamente al mismo tiempo: uno gana y el otro recibe `SlotUnavailableError`.
4. `test_04_cannot_book_blocked_slot`: Rechazo de reservas sobre horarios bloqueados.
5. `test_05_cannot_book_past_date`: Rechazo de reservas en fechas u horarios pasados.
6. `test_06_patient_cannot_view_other_patient_booking`: El token de un paciente solo otorga acceso a su propia reserva.
7. `test_07_patient_cannot_access_admin_panel`: Intentos de acceso al panel administrativo sin sesión válida son denegados.
8. `test_08_invalid_proof_rejected`: Archivos no permitidos (ej. ejecutables, scripts) son rechazados por validación binaria de *Magic Bytes*.
9. `test_09_proof_not_accessible_without_authorization`: Los comprobantes privados no pueden ser descargados sin permisos válidos.
10. `test_10_expired_pending_booking_frees_slot`: Una reserva vencida libera automáticamente el horario para otros pacientes.
11. `test_11_upload_proof_does_not_auto_approve`: La carga de un comprobante pasa a revisión pero NO aprueba automáticamente el pago.
12. `test_12_approve_or_reject_payment_updates_state`: La aprobación o el rechazo con motivo actualizan coherentemente el estado del pago y de la reserva.

---

## 5. Despliegue en Producción (Vercel + PostgreSQL)

El proyecto está diseñado para un despliegue sin fricciones en plataformas modernas como Vercel acopladas a una base de datos PostgreSQL administrada (Supabase, Neon, Railway o Render).

### Variables de Entorno en Producción
En el panel de tu proveedor de hosting (ej. Vercel), configurá:

```env
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://tu-dominio.com"

# Base de datos PostgreSQL
DATABASE_URL="postgresql://usuario:contraseña@servidor.com:5432/turnos_db?sslmode=require"

# Secreto para sesiones administrativas (32 caracteres o más)
JWT_SECRET="un-secreto-criptografico-extremadamente-seguro-generado-con-openssl"

# Almacenamiento de comprobantes
STORAGE_DRIVER="local" # o "s3"
# Si usás S3 / Cloudflare R2:
# S3_ENDPOINT="https://..."
# S3_BUCKET="turnos-comprobantes"
# S3_ACCESS_KEY_ID="..."
# S3_SECRET_ACCESS_KEY="..."

# Correo transaccional
EMAIL_DRIVER="resend" # o "console"
EMAIL_FROM="Consultorio <turnos@tu-dominio.com>"
RESEND_API_KEY="re_..."
```

### Aplicación de Migraciones en Producción
Para desplegar sobre PostgreSQL usando el esquema específico para Postgres:
```bash
npx prisma db push --schema=prisma/schema.postgresql.prisma
npx tsx prisma/seed.ts
```

---

## 6. Privacidad y Seguridad

- **Ley N° 25.326 de Protección de Datos Personales (Argentina)**: La aplicación minimiza la recolección de datos personales, limitándose al nombre, email y teléfono para coordinación administrativa.
- **Cero Datos Clínicos**: No se almacenan diagnósticos, motivos de consulta, notas terapéuticas ni historias clínicas.
- **Almacenamiento Privado de Comprobantes**: Los archivos se almacenan en un directorio fuera del alcance público del servidor web y su lectura requiere autorización obligatoria.
- **Cookies Seguras**: Las cookies de sesión utilizan directivas `HttpOnly`, `SameSite=Lax` y `Secure` en entornos de producción.
- **Sin Tarjetas de Crédito**: La plataforma no procesa ni almacena números de tarjeta ni datos bancarios sensibles de los pacientes.

---

## 7. Licencia y Créditos

Desarrollado para el consultorio de psicología de `LautaroAlderete68`.
Repositorio privado: `LautaroAlderete68/turnos-psicologia`.
Colaborador: `GerardoLujanMolina`.
