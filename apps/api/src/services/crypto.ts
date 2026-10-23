/**
 * AES-256-GCM Envelope Encryption
 * ISO/IEC 27001 A.10 Cryptography compliance
 *
 * Format payload (base64 JSON):
 * { iv: string, tag: string, cipher: string, salt: string }
 */

const ALGORITHM = 'AES-GCM';
const KEY_LEN = 256; // bits
const IV_LEN = 12;   // bytes — NIST recommended for GCM
const TAG_LEN = 128; // bits
const ITERATIONS = 310_000; // OWASP 2023 minimum for PBKDF2-SHA256

function getEncoder() {
  return new TextEncoder();
}

async function deriveKey(masterKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    getEncoder().encode(masterKey),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedPayload {
  iv: string;
  tag: string;
  cipher: string;
  salt: string;
}

export async function encryptCredential(
  plainText: string,
  masterKey: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key  = await deriveKey(masterKey, salt);

  // GCM returns ciphertext + 16-byte auth tag appended
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LEN },
    key,
    getEncoder().encode(plainText),
  );

  const cipherBytes = new Uint8Array(encrypted);
  const cipherText  = cipherBytes.slice(0, -16);
  const authTag     = cipherBytes.slice(-16);

  const payload: EncryptedPayload = {
    iv:     Buffer.from(iv).toString('base64'),
    tag:    Buffer.from(authTag).toString('base64'),
    cipher: Buffer.from(cipherText).toString('base64'),
    salt:   Buffer.from(salt).toString('base64'),
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function decryptCredential(
  encodedPayload: string,
  masterKey: string,
): Promise<string> {
  const payload: EncryptedPayload = JSON.parse(
    Buffer.from(encodedPayload, 'base64').toString('utf-8'),
  );

  const salt   = Buffer.from(payload.salt,   'base64');
  const iv     = Buffer.from(payload.iv,     'base64');
  const tag    = Buffer.from(payload.tag,    'base64');
  const cipher = Buffer.from(payload.cipher, 'base64');

  const key = await deriveKey(masterKey, salt);

  // Re-assemble ciphertext+tag for SubtleCrypto
  const combined = new Uint8Array(cipher.length + tag.length);
  combined.set(cipher);
  combined.set(tag, cipher.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LEN },
    key,
    combined,
  );

  return new TextDecoder().decode(decrypted);
}
