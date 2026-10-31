import { describe, expect, it } from 'bun:test';
import { encryptCredential, decryptCredential } from '../src/services/crypto';

describe('AES-256-GCM Envelope Encryption (Crypto Service)', () => {
  const masterKey = 'vintrix-super-secure-master-key-32b!';
  const secretText = 'ghp_secretTokenGithub1234567890abcdef';

  it('encrypts and decrypts secret correctly', async () => {
    const encrypted = await encryptCredential(secretText, masterKey);
    expect(encrypted).toBeString();
    expect(encrypted).not.toBe(secretText);

    const decrypted = await decryptCredential(encrypted, masterKey);
    expect(decrypted).toBe(secretText);
  });

  it('fails decryption when master key is invalid', async () => {
    const encrypted = await encryptCredential(secretText, masterKey);
    expect(
      decryptCredential(encrypted, 'wrong-key-attempt-0000000000000000')
    ).rejects.toThrow();
  });

  it('handles empty string plaintext', async () => {
    const encrypted = await encryptCredential('', masterKey);
    const decrypted = await decryptCredential(encrypted, masterKey);
    expect(decrypted).toBe('');
  });
});
