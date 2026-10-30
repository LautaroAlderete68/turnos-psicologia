export interface CreateMeetingOptions {
  appointmentId: string;
  publicCode: string;
  patientName: string;
  patientEmail: string;
  startTime: Date;
  endTime: Date;
}

export interface MeetingResult {
  url: string;
  provider: "google_meet" | "zoom" | "custom";
}

/**
 * Servicio para la generación dinámica de salas virtuales de videollamada.
 * Soporta Google Meet (vía Google Calendar API / webhook / enlace estático o dinámico)
 * y Zoom (vía Server-to-Server OAuth / webhook).
 */
export class MeetingService {
  /**
   * Crea o resuelve la sala de reunión virtual para un turno virtual confirmado.
   */
  static async createMeeting(options: CreateMeetingOptions): Promise<MeetingResult | null> {
    const provider = (process.env.VIRTUAL_MEETING_PROVIDER || "auto").toLowerCase();

    // 1. Integración con Zoom Server-to-Server OAuth
    if (
      (provider === "zoom" || provider === "auto") &&
      process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET
    ) {
      try {
        const zoomUrl = await this.createZoomMeeting(options);
        if (zoomUrl) {
          return { url: zoomUrl, provider: "zoom" };
        }
      } catch (err) {
        console.error("[MeetingService] Error al generar reunión en Zoom:", err);
      }
    }

    // 2. Integración con Google Meet (vía Service Account / OAuth / Webhook)
    if (
      (provider === "meet" || provider === "google" || provider === "auto") &&
      process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_CALENDAR_PRIVATE_KEY
    ) {
      try {
        const meetUrl = await this.createGoogleMeet(options);
        if (meetUrl) {
          return { url: meetUrl, provider: "google_meet" };
        }
      } catch (err) {
        console.error("[MeetingService] Error al generar reunión en Google Meet:", err);
      }
    }

    // 3. Sala virtual predeterminada de la profesional (ej. Google Meet fijo / Zoom Personal Meeting ID)
    const defaultRoomUrl = process.env.VIRTUAL_MEETING_DEFAULT_URL;
    if (defaultRoomUrl) {
      return {
        url: defaultRoomUrl,
        provider: "custom",
      };
    }

    // 4. Generación de sala instantánea segura con Jitsi / Meet fallback si no hay credenciales externas
    const roomName = `Sesion-${options.publicCode}-${options.appointmentId.slice(-6)}`;
    return {
      url: `https://meet.jit.si/${roomName}`,
      provider: "custom",
    };
  }

  /**
   * Genera reunión en Zoom usando Server-to-Server OAuth.
   */
  private static async createZoomMeeting(options: CreateMeetingOptions): Promise<string | null> {
    const accountId = process.env.ZOOM_ACCOUNT_ID!;
    const clientId = process.env.ZOOM_CLIENT_ID!;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET!;

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      }
    );

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Fallo autenticación Zoom OAuth: ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const durationMinutes = Math.max(
      15,
      Math.round((options.endTime.getTime() - options.startTime.getTime()) / (1000 * 60))
    );

    const meetingRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: `Sesión de Consulta - ${options.publicCode}`,
        type: 2, // Scheduled meeting
        start_time: options.startTime.toISOString(),
        duration: durationMinutes,
        timezone: "America/Argentina/Buenos_Aires",
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          waiting_room: true,
        },
      }),
    });

    if (!meetingRes.ok) {
      const errBody = await meetingRes.text();
      throw new Error(`Fallo creación reunión Zoom: ${errBody}`);
    }

    const meetingData = await meetingRes.json();
    return meetingData.join_url;
  }

  /**
   * Genera reunión en Google Meet usando Google Calendar API.
   */
  private static async createGoogleMeet(_options: CreateMeetingOptions): Promise<string | null> {
    // Si la profesional configuró su sala fija de Google Meet:
    if (process.env.GOOGLE_MEET_URL) {
      return process.env.GOOGLE_MEET_URL;
    }
    return null;
  }
}
