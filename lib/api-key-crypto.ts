import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const API_KEY_ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getApiKeyEncryptionKey(): Buffer {
  const rawValue = process.env.API_KEY_ENCRYPTION_KEY;

  if (!rawValue) {
    throw new Error("Missing API_KEY_ENCRYPTION_KEY environment variable");
  }

  const decoded = Buffer.from(rawValue, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      "API_KEY_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  }

  return decoded;
}

export function encryptApiKey(plainTextApiKey: string): string {
  const encryptionKey = getApiKeyEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(API_KEY_ENCRYPTION_ALGORITHM, encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainTextApiKey, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptApiKey(encryptedPayload: string): string {
  const encryptionKey = getApiKeyEncryptionKey();
  const [ivBase64, authTagBase64, encryptedBase64] = encryptedPayload.split(".");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted API key payload");
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = createDecipheriv(
    API_KEY_ENCRYPTION_ALGORITHM,
    encryptionKey,
    iv,
  );
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

