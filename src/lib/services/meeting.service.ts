import prisma from "@/lib/prisma";

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
 * Servicio para la resolución y asignación de salas virtuales de Google Meet / Zoom.
 */
export class MeetingService {
  /**
   * Obtiene o genera el enlace de videollamada para un turno virtual confirmado.
   * Prioriza Google Meet configurado por la profesional en el perfil o en variables de entorno.
   */
  static async createMeeting(options: CreateMeetingOptions): Promise<MeetingResult | null> {
    const provider = (process.env.VIRTUAL_MEETING_PROVIDER || "auto").toLowerCase();

    // 1. Integración con Zoom Server-to-Server OAuth (si está explícitamente configurado)
    if (
      provider === "zoom" &&
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

    // 2. Google Meet desde el perfil de la profesional (Base de Datos)
    try {
      const profile = await prisma.psychologistProfile.findFirst({
        select: { googleMeetUrl: true },
      });
      if (profile?.googleMeetUrl && profile.googleMeetUrl.trim().length > 0) {
        return {
          url: profile.googleMeetUrl.trim(),
          provider: "google_meet",
        };
      }
    } catch (err) {
      console.error("[MeetingService] Error al consultar Google Meet del perfil:", err);
    }

    // 3. Google Meet desde variable de entorno GOOGLE_MEET_URL o VIRTUAL_MEETING_DEFAULT_URL
    const envMeetUrl = process.env.GOOGLE_MEET_URL || process.env.VIRTUAL_MEETING_DEFAULT_URL;
    if (envMeetUrl && envMeetUrl.trim().length > 0) {
      return {
        url: envMeetUrl.trim(),
        provider: "google_meet",
      };
    }

    // 4. Fallback por defecto a Google Meet
    return {
      url: "https://meet.google.com",
      provider: "google_meet",
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
}
