import nodemailer, { type Transporter } from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static driver = process.env.EMAIL_DRIVER || "console";
  private static from = process.env.EMAIL_FROM || "Consultorio Psicológico <turnos@consultorio.com>";
  private static appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  private static smtpTransporter: Transporter | null = null;

  private static getSmtpTransporter(): Transporter {
    if (!this.smtpTransporter) {
      const isGmail = this.driver === "gmail" || process.env.SMTP_HOST === "smtp.gmail.com";

      if (isGmail) {
        this.smtpTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.SMTP_USER || process.env.GMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
          },
        });
      } else {
        this.smtpTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.mailtrap.io",
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      }
    }
    return this.smtpTransporter;
  }

  /**
   * Envía un correo electrónico transaccional.
   * Soporta: "gmail", "smtp", "resend" o "console".
   */
  static async send(options: SendEmailOptions): Promise<{ success: boolean; id?: string }> {
    // 1. Integración con Gmail / SMTP mediante Nodemailer
    if (this.driver === "gmail" || this.driver === "smtp") {
      try {
        const transporter = this.getSmtpTransporter();
        const info = await transporter.sendMail({
          from: this.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        return { success: true, id: info.messageId };
      } catch (err) {
        console.error(`Error al enviar email mediante ${this.driver}:`, err);
        return { success: false };
      }
    }

    // 2. Integración con Resend si la clave está provista
    if (this.driver === "resend" && process.env.RESEND_API_KEY) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: this.from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("Error al enviar email mediante Resend:", err);
          return { success: false };
        }

        const data = await resp.json();
        return { success: true, id: data.id };
      } catch (err) {
        console.error("Excepción en EmailService (Resend):", err);
        return { success: false };
      }
    }

    // 3. Driver de consola (entorno de pruebas / desarrollo / sin credenciales externas)
    console.log("------------------------------------------------------------");
    console.log(`[EMAIL DISPATCH - ${this.driver.toUpperCase()}]`);
    console.log(`Para: ${options.to}`);
    console.log(`De: ${this.from}`);
    console.log(`Asunto: ${options.subject}`);
    console.log(`Fecha: ${new Date().toISOString()}`);
    console.log("Cuerpo:");
    console.log(options.text || options.html.replace(/<[^>]+>/g, " "));
    console.log("------------------------------------------------------------");

    return { success: true, id: `mock-${Date.now()}` };
  }

  /**
   * Notificación: Reserva recibida con instrucciones y enlace de pago.
   */
  static async sendBookingCreated(data: {
    to: string;
    patientName: string;
    publicCode: string;
    dateTimeFormatted: string;
    modality: string;
    price: number;
    token: string;
  }) {
    const magicLink = `${this.appUrl}/turno/${data.token}`;
    const subject = `Reserva recibida - Código ${data.publicCode}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #2D3748; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
        <h2 style="color: #BE123C;">Tu reserva fue recibida con éxito</h2>
        <p>Hola <strong>${data.patientName}</strong>,</p>
        <p>Registramos tu solicitud de turno para el día <strong>${data.dateTimeFormatted}</strong> (${data.modality}).</p>
        <div style="background-color: #F7FAFC; padding: 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Código de turno:</strong> ${data.publicCode}</p>
          <p style="margin: 4px 0;"><strong>Importe de la sesión:</strong> $${data.price.toLocaleString("es-AR")}</p>
        </div>
        <p>Para asegurar tu lugar, por favor completá la transferencia bancaria y adjuntá tu comprobante a través del siguiente enlace seguro:</p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${magicLink}" style="background-color: #E11D48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver mi reserva y adjuntar comprobante</a>
        </p>
        <p style="font-size: 13px; color: #718096;">Este enlace es personal y confidencial. No lo compartas con terceros.</p>
      </div>
    `;
    return this.send({ to: data.to, subject, html });
  }

  /**
   * Notificación: Comprobante recibido en revisión.
   */
  static async sendProofReceived(data: { to: string; patientName: string; publicCode: string }) {
    const subject = `Comprobante recibido - Turno ${data.publicCode}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #2D3748; max-width: 600px; margin: auto; padding: 24px;">
        <h2 style="color: #BE123C;">Comprobante en revisión</h2>
        <p>Hola <strong>${data.patientName}</strong>,</p>
        <p>Recibimos tu comprobante de pago para el turno <strong>${data.publicCode}</strong>. La profesional lo revisará a la brevedad y te notificaremos la confirmación definitiva.</p>
      </div>
    `;
    return this.send({ to: data.to, subject, html });
  }

  /**
   * Notificación: Turno confirmado tras aprobar el comprobante.
   */
  static async sendBookingConfirmed(data: {
    to: string;
    patientName: string;
    publicCode: string;
    dateTimeFormatted: string;
    modality: string;
    token: string;
    meetingUrl?: string | null;
  }) {
    const magicLink = `${this.appUrl}/turno/${data.token}`;
    const subject = `Turno confirmado - Código ${data.publicCode}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #2D3748; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
        <h2 style="color: #BE123C;">¡Tu turno está confirmado!</h2>
        <p>Hola <strong>${data.patientName}</strong>,</p>
        <p>El pago de tu sesión ha sido aprobado. Te esperamos el día <strong>${data.dateTimeFormatted}</strong> (${data.modality}).</p>
        ${
          data.meetingUrl
            ? `<div style="background-color: #FFF1F2; border: 1px solid #FECDD3; padding: 16px; border-radius: 6px; margin: 16px 0; text-align: center;">
                 <p style="margin: 0 0 10px 0; font-weight: bold; color: #9F1239;">Enlace de la sesión virtual:</p>
                 <a href="${data.meetingUrl}" style="background-color: #E11D48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ingresar a la sala</a>
               </div>`
            : ""
        }
        <p style="text-align: center; margin: 24px 0;">
          <a href="${magicLink}" style="background-color: #E11D48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acceder a los detalles de mi turno</a>
        </p>
      </div>
    `;
    return this.send({ to: data.to, subject, html });
  }

  /**
   * Notificación: Comprobante rechazado.
   */
  static async sendPaymentRejected(data: {
    to: string;
    patientName: string;
    publicCode: string;
    reason: string;
    token: string;
  }) {
    const magicLink = `${this.appUrl}/turno/${data.token}`;
    const subject = `Observación sobre tu comprobante - Turno ${data.publicCode}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #2D3748; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
        <h2 style="color: #C53030;">Comprobante no aprobado</h2>
        <p>Hola <strong>${data.patientName}</strong>,</p>
        <p>No pudimos validar el comprobante adjunto para el turno <strong>${data.publicCode}</strong>.</p>
        <p><strong>Motivo indicado:</strong> ${data.reason}</p>
        <p>Por favor, ingresá en el siguiente enlace para adjuntar un nuevo comprobante o verificar la transferencia:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${magicLink}" style="background-color: #E11D48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Revisar y adjuntar nuevo comprobante</a>
        </p>
      </div>
    `;
    return this.send({ to: data.to, subject, html });
  }

  /**
   * Notificación: Turno cancelado.
   */
  static async sendBookingCancelled(data: {
    to: string;
    patientName: string;
    publicCode: string;
    reason?: string;
  }) {
    const subject = `Turno cancelado - Código ${data.publicCode}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #2D3748; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
        <h2 style="color: #4A5568;">Turno cancelado</h2>
        <p>Hola <strong>${data.patientName}</strong>,</p>
        <p>El turno con código <strong>${data.publicCode}</strong> ha sido cancelado.</p>
        ${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ""}
      </div>
    `;
    return this.send({ to: data.to, subject, html });
  }
}
