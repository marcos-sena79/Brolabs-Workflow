/**
 * Criptografia simétrica de segredos no Postgres (AES-256-GCM).
 *
 * Usado pelos segredos de webhook (item 4) e pelos tokens OAuth (item 9).
 * A chave vem de `APP_ENCRYPTION_KEY`; na ausência, deriva-se de `JWT_SECRET`
 * (com aviso) para não quebrar ambientes legados — **nunca** usar valor fixo.
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!raw) {
    throw new Error('APP_ENCRYPTION_KEY (ou JWT_SECRET) não definida — segredos não podem ser criptografados');
  }
  // deriva 32 bytes determinísticos (SHA-256) da chave configurada
  return crypto.createHash('sha256').update(raw).digest();
}

/** Criptografa um texto: `iv:tag:ciphertext` (base64url). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(':');
}

/** Descriptografa um valor produced por `encryptSecret`. */
export function decryptSecret(payload: string): string {
  const parts = String(payload || '').split(':');
  if (parts.length !== 3) throw new Error('Segredo criptografado inválido');
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

/** Indica se o texto parece já estar criptografado (formato iv:tag:data). */
export function isEncrypted(payload: string): boolean {
  const parts = String(payload || '').split(':');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/** Hash estável de string (ex.: IP de visitante) — irreversível. */
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}
