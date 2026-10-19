import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyPassword, createAdminToken, COOKIE_NAME } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido").toLowerCase(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimit = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000); // Max 5 intentos por 15 min
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Demasiados intentos fallidos. Por seguridad, esperá 15 minutos." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Credenciales de acceso incorrectas." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Credenciales de acceso incorrectas." },
        { status: 401 }
      );
    }

    const token = await createAdminToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 días
    });

    return response;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message || "Datos incompletos" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Error al procesar el inicio de sesión." },
      { status: 500 }
    );
  }
}
