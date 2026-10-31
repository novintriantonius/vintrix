import { describe, expect, it } from 'bun:test';
import { reindexEvents, type ReindexEvent } from '../src/services/reindexEvents';

describe('Reindex Events Service', () => {
  it('emits and captures reindex event properly', async () => {
    const wsId = 'workspace-test-123';
    const sourceId = 'source-test-456';

    const testEvent: ReindexEvent = {
      type: 'progress',
      sourceId,
      workspaceId: wsId,
      message: 'Scanning files',
      progressPercent: 50,
      timestamp: new Date().toISOString(),
    };

    const capturedPromise = new Promise<ReindexEvent>((resolve) => {
      const handler = (evt: unknown) => {
        (reindexEvents as any).removeListener(`reindex:${wsId}`, handler);
        resolve(evt as ReindexEvent);
      };
      (reindexEvents as any).addListener(`reindex:${wsId}`, handler);
    });

    reindexEvents.emitEvent(testEvent);
    const captured = await capturedPromise;
    expect(captured.workspaceId).toBe(wsId);
    expect(captured.progressPercent).toBe(50);
  });
});
