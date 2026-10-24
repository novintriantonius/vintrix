import { describe, expect, it } from 'bun:test';
import { tokenize, computeBM25Score } from '../src/services/retrieval';

describe('BM25 Hybrid Retrieval Utilities', () => {
  it('tokenizes camelCase and path patterns cleanly', () => {
    const tokens = tokenize('authRouter in src/routes/authController.ts');
    expect(tokens).toContain('auth');
    expect(tokens).toContain('router');
    expect(tokens).toContain('controller');
    expect(tokens).toContain('src');
    expect(tokens).toContain('routes');
  });

  it('filters out single character symbols and punctuation', () => {
    const tokens = tokenize('a ! @ # $ test_fn()');
    expect(tokens).toContain('test_fn');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('!');
  });

  it('scores documents higher when term frequency and IDF match', () => {
    const query = ['database', 'postgres'];
    const doc1 = ['database', 'postgres', 'connection', 'pool', 'database'];
    const doc2 = ['frontend', 'react', 'button', 'component'];

    const termDocFrequencies = new Map<string, number>([
      ['database', 1],
      ['postgres', 1],
    ]);

    const score1 = computeBM25Score(query, doc1, doc1.length, 10, termDocFrequencies, 2);
    const score2 = computeBM25Score(query, doc2, doc2.length, 10, termDocFrequencies, 2);

    expect(score1).toBeGreaterThan(0);
    expect(score2).toBe(0);
  });
});
