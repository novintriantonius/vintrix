import { describe, expect, it } from 'bun:test';
import { formatAuthenticatedGitUrl, assertReadOnlyGitArgs } from '../src/services/git';

describe('Git Service (Read-Only Enforcement)', () => {
  it('formats authenticated HTTPS git url correctly with oauth2 token', () => {
    const url = 'https://github.com/org/repo.git';
    const formatted = formatAuthenticatedGitUrl(url, 'my-token');
    expect(formatted).toContain('oauth2:my-token@github.com');
  });

  it('leaves ssh url or non-token urls untouched', () => {
    const sshUrl = 'git@github.com:org/repo.git';
    expect(formatAuthenticatedGitUrl(sshUrl, null)).toBe(sshUrl);
    expect(formatAuthenticatedGitUrl(sshUrl, 'some-token')).toBe(sshUrl);
  });

  it('allows safe read-only git operations', () => {
    expect(() => assertReadOnlyGitArgs([])).not.toThrow();
    expect(() => assertReadOnlyGitArgs(['clone', 'https://github.com/repo.git'])).not.toThrow();
    expect(() => assertReadOnlyGitArgs(['fetch', 'origin'])).not.toThrow();
    expect(() => assertReadOnlyGitArgs(['log', '-n', '5'])).not.toThrow();
    expect(() => assertReadOnlyGitArgs(['status'])).not.toThrow();
  });

  it('blocks forbidden git write operations', () => {
    expect(() => assertReadOnlyGitArgs(['push', 'origin', 'main'])).toThrow(/strictly forbidden/);
    expect(() => assertReadOnlyGitArgs(['commit', '-m', 'test'])).toThrow(/strictly forbidden/);
    expect(() => assertReadOnlyGitArgs(['rm', '-rf', 'secret'])).toThrow(/strictly forbidden/);
    expect(() => assertReadOnlyGitArgs(['rebase', 'main'])).toThrow(/strictly forbidden/);
  });

  it('blocks suspicious git flags', () => {
    expect(() => assertReadOnlyGitArgs(['clone', '--upload-pack=evil', 'http://repo'])).toThrow(
      'Prohibited Git flag'
    );
    expect(() => assertReadOnlyGitArgs(['fetch', '-c', 'protocol.ext.allow=always'])).toThrow(
      'Prohibited Git flag'
    );
  });

  it('handles testGitConnection authentication and repository errors cleanly', async () => {
    const { testGitConnection } = await import('../src/services/git');
    const result = await testGitConnection({
      repoUrl: 'https://github.com/non-existent-user-123456/private-vintrix-repo-xyz.git',
      branch: 'main',
      token: 'fake-token-123',
    });
    expect(result.success).toBeFalse();
    expect(result.error).toBeDefined();
  });
});
