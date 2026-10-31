import { EventEmitter } from 'node:events';

export interface ReindexEvent {
  type: 'started' | 'progress' | 'completed' | 'error';
  sourceId: string;
  sourceName?: string;
  workspaceId: string;
  message: string;
  progressPercent?: number;
  currentFileIndex?: number;
  totalFiles?: number;
  currentFileName?: string;
  totalFilesIndexed?: number;
  nodesScanned?: number;
  edgesScanned?: number;
  // Full graph payload for DB-less environments
  graphNodes?: any[];
  graphEdges?: any[];
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
