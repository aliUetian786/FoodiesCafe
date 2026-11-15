import { NextRequest } from 'next/server';
import { subscribeToRealtime, getEventsSince, RealtimeEvent } from '@/lib/realtime';
import { getAuthFromRequest } from '@/lib/auth';

function normalizeBranchId(id?: string | null): string | undefined {
  if (!id) return undefined;
  if (id === 'all') return 'all';
  if (id === 'branch-gulberg' || id.includes('gulberg')) return 'gulberg-lahore';
  if (id === 'branch-f7' || id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
  if (id === 'branch-clifton' || id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
  return id;
}

function shouldDeliverEvent(
  event: RealtimeEvent,
  role: string,
  scopedBranchId?: string,
  customerId?: string
): boolean {
  // Global menu/branch configuration updates are safe for all clients
  if (event.type === 'MENU_UPDATED' || event.type === 'BRANCH_UPDATED') {
    if (role === 'customer') {
      return true;
    }
    if (scopedBranchId && scopedBranchId !== 'all' && event.branchId) {
      if (normalizeBranchId(scopedBranchId) !== normalizeBranchId(event.branchId)) {
        return false;
      }
    }
    return true;
  }

  // Customers only receive events for their own orders (never other customers' orders)
  if (role === 'customer') {
    if (event.type === 'ORDER_CREATED' || event.type === 'ORDER_UPDATED') {
      if (!customerId) return false;
      const evtCustomerId = event.customerId || event.data?.customerId;
      return evtCustomerId === customerId;
    }
    if (event.type === 'TABLE_UPDATED') {
      return !scopedBranchId || !event.branchId || event.branchId === scopedBranchId;
    }
    return false;
  }

  // Platform owner can receive all branch events
  if (role === 'platform_owner') {
    if (scopedBranchId && scopedBranchId !== 'all' && event.branchId && normalizeBranchId(event.branchId) !== normalizeBranchId(scopedBranchId)) {
      return false;
    }
    return true;
  }

  // Branch staff only receive events for their own assigned branch
  if (scopedBranchId && event.branchId && normalizeBranchId(event.branchId) !== normalizeBranchId(scopedBranchId)) {
    return false;
  }

  return true;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawBranchId = searchParams.get('branchId');
  const queryRole = searchParams.get('role');
  const queryCustomerId = searchParams.get('customerId') || undefined;
  const lastEventId =
    req.headers.get('last-event-id') || searchParams.get('lastEventId') || undefined;

  // Extract authenticated session context
  const auth = getAuthFromRequest(req);
  const effectiveRole = auth.authenticated
    ? auth.role
    : (queryRole && ['platform_owner', 'branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff'].includes(queryRole)
        ? (queryRole as any)
        : 'customer');
  const isStaff = effectiveRole !== 'customer';
  const isOwner = effectiveRole === 'platform_owner';
  const role = effectiveRole;

  // Enforce subscription scoping: only platform_owner can subscribe to 'all'.
  // Staff are strictly locked to their assigned branch.
  const normalizedBranch = normalizeBranchId(rawBranchId);
  const scopedBranchId = isOwner
    ? normalizedBranch || 'all'
    : isStaff
    ? normalizeBranchId(rawBranchId || auth.branchId || 'gulberg-lahore')
    : normalizeBranchId(normalizedBranch || 'gulberg-lahore');

  const customerId = auth.authenticated && auth.role === 'customer' ? auth.userId : queryCustomerId;

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection greeting with retry hint (3000ms base)
      const connectPayload = JSON.stringify({
        connected: true,
        role,
        branchId: scopedBranchId,
        timestamp: Date.now(),
      });
      controller.enqueue(
        encoder.encode(`retry: 3000\nevent: connected\ndata: ${connectPayload}\n\n`)
      );

      // 2. Replay missed events if client reconnected with Last-Event-ID
      if (lastEventId) {
        const missed = getEventsSince(lastEventId);
        for (const event of missed) {
          if (shouldDeliverEvent(event, role, scopedBranchId, customerId)) {
            try {
              const frame = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(frame));
            } catch {
              // Ignore if stream closed
            }
          }
        }
      }

      // 3. Subscribe to live Redis/local realtime bus
      cleanup = subscribeToRealtime((event: RealtimeEvent) => {
        if (!shouldDeliverEvent(event, role, scopedBranchId, customerId)) {
          return;
        }

        try {
          const payload = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed
        }
      });

      // 4. Heartbeat every 20 seconds (within 15-25s target)
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 20000);
    },
    cancel() {
      if (cleanup) cleanup();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
