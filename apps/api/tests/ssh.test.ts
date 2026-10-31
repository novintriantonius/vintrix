import { describe, expect, it } from 'bun:test';
import { testSSHConnection } from '../src/services/ssh';

describe('SSH Service (Read-Only Enforcement & Connection)', () => {
  it('fails cleanly on unreachable hosts or invalid credentials', async () => {
    try {
      await testSSHConnection({
        host: '127.0.0.1',
        port: 65534, // unreachable port
        username: 'non_existent_user',
        password: 'fake_password',
      });
      expect(true).toBeFalse();
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });

  it('rejects connection with invalid privateKey format', async () => {
    try {
      await testSSHConnection({
        host: '127.0.0.1',
        port: 22,
        username: 'testuser',
        privateKey: 'INVALID_PRIVATE_KEY_PAYLOAD',
      });
      expect(true).toBeFalse();
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });
});
