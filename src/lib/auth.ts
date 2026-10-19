import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET_STRING = process.env.JWT_SECRET || "fallback-secret-at-least-32-chars-long-for-dev";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);
const COOKIE_NAME = "admin_session";

export interface AdminPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Genera un token JWT firmado para la sesión de administración.
 */
export async function createAdminToken(payload: AdminPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

/**
 * Verifica un token JWT de administrador y retorna su contenido si es válido.
 */
export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || payload.role !== "ADMIN") {
      return null;
    }
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

/**
 * Comprueba la sesión actual en las cookies HTTP.
 */
export async function getAdminSession(): Promise<AdminPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}

/**
 * Exige que exista una sesión de administrador válida, de lo contrario lanza error.
 */
export async function requireAdminSession(): Promise<AdminPayload> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("UNAUTHORIZED_ADMIN");
  }
  return session;
}

/**
 * Compara contraseña en texto plano contra el hash almacenado con bcrypt.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Genera hash seguro de contraseña.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export { COOKIE_NAME };
