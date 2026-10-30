import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type SupportedMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export interface FileValidationResult {
  isValid: boolean;
  mimeType?: SupportedMimeType;
  error?: string;
}

/**
 * Detecta el tipo real de archivo examinando su cabecera binaria (Magic Bytes).
 * No confía en la extensión ni en el Content-Type reportado por el cliente.
 */
export function validateFileMagicBytes(buffer: Buffer): FileValidationResult {
  if (!buffer || buffer.length < 8) {
    return { isValid: false, error: "El archivo está vacío o dañado." };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, error: "El archivo supera el tamaño máximo permitido de 10 MB." };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, mimeType: "image/jpeg" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, mimeType: "image/png" };
  }

  // 3. PDF: 25 50 44 46 (%PDF)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { isValid: true, mimeType: "application/pdf" };
  }

  // 4. WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isValid: true, mimeType: "image/webp" };
  }

  return {
    isValid: false,
    error: "Formato no permitido. Solo se aceptan archivos válidos JPG, PNG, WEBP o PDF.",
  };
}

export interface StorageResult {
  storageKey: string;
  sizeBytes: number;
  mimeType: SupportedMimeType;
}

export interface IStorageProvider {
  save(buffer: Buffer, originalFilename: string, mimeType: SupportedMimeType): Promise<StorageResult>;
  get(storageKey: string): Promise<Buffer | null>;
  delete(storageKey: string): Promise<boolean>;
}

/**
 * Driver de almacenamiento local privado.
 * En Vercel / serverless usa el directorio temporal /tmp que cuenta con permisos de escritura.
 */
export class LocalDiskStorageProvider implements IStorageProvider {
  private getBaseDir(): string {
    // Si se especificó explícitamente una ruta
    if (process.env.STORAGE_LOCAL_PATH) {
      return path.resolve(process.env.STORAGE_LOCAL_PATH);
    }
    // En Vercel / AWS Lambda la única carpeta con permisos de escritura es /tmp
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return path.join(os.tmpdir(), "turnos-proofs");
    }
    return path.resolve(process.cwd(), "./storage/proofs");
  }

  private ensureDir(): string {
    const dir = this.getBaseDir();
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async save(buffer: Buffer, _originalFilename: string, mimeType: SupportedMimeType): Promise<StorageResult> {
    const baseDir = this.ensureDir();
    const randomUuid = crypto.randomUUID();
    const ext = mimeType === "application/pdf" ? ".pdf" : mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
    const storageKey = `${randomUuid}${ext}`;
    const filePath = path.join(baseDir, storageKey);

    await fs.writeFile(filePath, buffer);

    return {
      storageKey,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    const baseDir = this.ensureDir();
    const safeKey = path.basename(storageKey);
    const filePath = path.join(baseDir, safeKey);

    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    const baseDir = this.ensureDir();
    const safeKey = path.basename(storageKey);
    const filePath = path.join(baseDir, safeKey);

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Instancia única del servicio de almacenamiento
export const storageProvider: IStorageProvider = new LocalDiskStorageProvider();
