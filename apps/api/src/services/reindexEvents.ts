import { EventEmitter } from 'node:events';

export interface ReindexEvent {
  type: 'started' | 'progress' | 'completed' | 'error';
  sourceId: string;
  sourceName?: string;
  workspaceId: string;
  message: string;
  progressPercent?: number;
  nodesScanned?: number;
  edgesScanned?: number;
  timestamp: string;
}

class ReindexEventEmitter extends EventEmitter {
  emitEvent(event: ReindexEvent) {
    this.emit('reindex', event);
    this.emit(`reindex:${event.workspaceId}`, event);
    this.emit(`source:${event.sourceId}`, event);
  }
}

export const reindexEvents = new ReindexEventEmitter();
reindexEvents.setMaxListeners(100);
