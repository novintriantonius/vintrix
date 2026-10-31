import { describe, expect, it } from 'bun:test';
import { tokenize, computeBM25Score, isConfidentialResource } from '../src/services/retrieval';

describe('BM25 Hybrid Retrieval Utilities', () => {
  it('tokenizes camelCase and path patterns cleanly', () => {
    const text = 'src/services/authController.ts';
    const tokens = tokenize(text);
    expect(tokens).toContain('src');
    expect(tokens).toContain('services');
    expect(tokens).toContain('auth');
    expect(tokens).toContain('controller');
    expect(tokens).toContain('ts');
  });

  it('filters out single character symbols and punctuation', () => {
    const text = 'a + b - c / d * e % f';
    const tokens = tokenize(text);
    expect(tokens.length).toBe(0);
  });

  it('scores documents higher when term frequency and IDF match', () => {
    const queryTokens = ['auth', 'login'];
    const docTokens = ['auth', 'login', 'token', 'user', 'session'];
    const termDocFreq = new Map([
      ['auth', 2],
      ['login', 1],
    ]);

    const score = computeBM25Score(queryTokens, docTokens, docTokens.length, 10, termDocFreq, 5);
    expect(score).toBeGreaterThan(0);
  });

  it('accurately identifies confidential resources and secret files', () => {
    expect(isConfidentialResource('.env', 'env file')).toBeTrue();
    expect(isConfidentialResource('server.key', 'tls private key')).toBeTrue();
    expect(isConfidentialResource('id_rsa', 'ssh key')).toBeTrue();
    expect(isConfidentialResource('credentials.json', 'google credentials')).toBeTrue();
    expect(isConfidentialResource('.env.example', 'template')).toBeFalse();
    expect(isConfidentialResource('src/components/Header.tsx', 'Header component')).toBeFalse();
  });

  it('retrieveRelevantContext returns empty array if query has no valid tokens', async () => {
    const { retrieveRelevantContext } = await import('../src/services/retrieval');
    const res = await retrieveRelevantContext('ws-123', '   ');
    expect(res).toEqual([]);
  });
});
