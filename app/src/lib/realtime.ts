/**
 * FoodiesCafe Real-Time Multi-Instance Event Bus (Redis Pub/Sub + Ring Buffer Replay)
 * Supports 500+ concurrent SSE connections across multiple instances via REDIS_URL,
 * with automatic in-memory fallback and Last-Event-ID replay buffer.
 */

import { getRedisClient, getRedisSubscriber, cacheInvalidatePrefix } from '@/lib/redis';

export type RealtimeEventType =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'TABLE_UPDATED'
  | 'SHIFT_UPDATED'
  | 'MENU_UPDATED'
  | 'USER_UPDATED'
  | 'BRANCH_UPDATED'
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_UPDATED'
  | 'SYNC_TRIGGER';

export interface RealtimeEvent {
  id: string;
  seq: number;
  type: RealtimeEventType;
  branchId?: string;
  orderId?: string;
  customerId?: string;
  tableNumber?: string;
  data?: any;
  timestamp: number;
}

type EventListener = (event: RealtimeEvent) => void;

const REDIS_CHANNEL = 'fc:realtime:events';
const MAX_HISTORY_SIZE = 500;

declare global {
  // eslint-disable-next-line no-var
  var __foodiesRealtimeBusV2:
    | {
        listeners: Set<EventListener>;
        history: RealtimeEvent[];
        seq: number;
        redisSubscribed: boolean;
      }
    | undefined;
}

function getBus() {
  if (!global.__foodiesRealtimeBusV2) {
    global.__foodiesRealtimeBusV2 = {
      listeners: new Set<EventListener>(),
      history: [],
      seq: 0,
      redisSubscribed: false,
    };
  }
  const bus = global.__foodiesRealtimeBusV2;

  if (!bus.redisSubscribed) {
    const sub = getRedisSubscriber();
    if (sub) {
      bus.redisSubscribed = true;
      sub.subscribe(REDIS_CHANNEL).catch(() => {
        bus.redisSubscribed = false;
      });
      sub.on('message', (channel: string, message: string) => {
        if (channel !== REDIS_CHANNEL) return;
        try {
          const parsed = JSON.parse(message) as RealtimeEvent & { originInstanceId?: string };
          if (parsed.originInstanceId === getInstanceId()) {
            return; // Already dispatched locally
          }
          dispatchLocal(parsed);
        } catch {
          // Ignore malformed pub/sub message
        }
      });
    }
  }

  return bus;
}

let instanceId: string | null = null;
function getInstanceId(): string {
  if (!instanceId) {
    instanceId = `inst-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return instanceId;
}

function dispatchLocal(event: RealtimeEvent) {
  const bus = getBus();
  // Avoid duplicate event ids in history
  if (!bus.history.some((e) => e.id === event.id)) {
    bus.history.push(event);
    if (bus.history.length > MAX_HISTORY_SIZE) {
      bus.history.shift();
    }
  }
  for (const listener of bus.listeners) {
    try {
      listener(event);
    } catch {
      // Ignore dropped listener
    }
  }
}

/**
 * Subscribe an SSE stream to real-time events
 */
export function subscribeToRealtime(listener: EventListener): () => void {
  const bus = getBus();
  bus.listeners.add(listener);
  return () => {
    bus.listeners.delete(listener);
  };
}

/**
 * Returns events that occurred after the given Last-Event-ID for seamless SSE reconnection
 */
export function getEventsSince(lastEventId?: string | null): RealtimeEvent[] {
  if (!lastEventId) return [];
  const bus = getBus();
  const idx = bus.history.findIndex((e) => e.id === lastEventId);
  if (idx === -1) {
    // If lastEventId encodes a timestamp (`evt-seq-ts`), filter by timestamp
    const parts = lastEventId.split('-');
    const ts = Number(parts[parts.length - 1]);
    if (!isNaN(ts) && ts > 0) {
      return bus.history.filter((e) => e.timestamp > ts);
    }
    return [];
  }
  return bus.history.slice(idx + 1);
}

/**
 * Returns number of active SSE connections on this server instance
 */
export function getActiveSseConnections(): number {
  return getBus().listeners.size;
}

/**
 * Emit a real-time event to all local SSE connections and publish to Redis pub/sub
 */
export function broadcastRealtimeEvent(
  event: Omit<RealtimeEvent, 'id' | 'seq' | 'timestamp'> & { timestamp?: number }
): RealtimeEvent {
  // Dine-in orders occupy/release tables, so order events must also drop the cached table list
  // (otherwise waiters saw a just-taken table as "available" for up to the cache TTL).
  if (event.type === 'TABLE_UPDATED' || event.type === 'ORDER_CREATED' || event.type === 'ORDER_UPDATED') {
    cacheInvalidatePrefix('tables:branch:').catch(() => {});
  }
  cacheInvalidatePrefix('sync:payload:').catch(() => {});
  const bus = getBus();
  bus.seq += 1;
  const now = event.timestamp || Date.now();
  const fullEvent: RealtimeEvent = {
    ...event,
    seq: bus.seq,
    id: `evt-${bus.seq}-${now}`,
    customerId: event.customerId || event.data?.customerId || undefined,
    branchId: event.branchId || event.data?.branchId || undefined,
    orderId: event.orderId || event.data?.id || event.data?.orderId || undefined,
    timestamp: now,
  };

  dispatchLocal(fullEvent);

  const pub = getRedisClient();
  if (pub && pub.status === 'ready') {
    pub
      .publish(
        REDIS_CHANNEL,
        JSON.stringify({ ...fullEvent, originInstanceId: getInstanceId() })
      )
      .catch(() => {});
  }

  return fullEvent;
}

/**
 * Convenience helper for route handlers (`publishEvent('table_updated', { ... })`)
 */
export function publishEvent(type: string, payload: Record<string, any> = {}): RealtimeEvent {
  const normalizedType = type.toUpperCase() as RealtimeEventType;
  return broadcastRealtimeEvent({
    type: normalizedType,
    branchId: payload.branchId,
    orderId: payload.orderId || payload.id,
    customerId: payload.customerId,
    tableNumber: payload.tableNumber ? String(payload.tableNumber) : undefined,
    data: payload,
  });
}
