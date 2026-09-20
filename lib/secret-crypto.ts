import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSecretKey,
  randomBytes,
} from "crypto";

function key() {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  if (!secret || secret.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY deve ter pelo menos 32 caracteres.");
  }

  return createSecretKey(
    createHash("sha256").update(secret).digest()
  );
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");

  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Token criptografado inválido.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivValue, "base64url")
  );

  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
