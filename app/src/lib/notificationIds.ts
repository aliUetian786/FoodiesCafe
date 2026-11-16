/**
 * Deterministic notification ids — shared by the browser (optimistic notifications) and the server.
 *
 * Previously the server used random ids and the browser used `notif-status-<order>-<status>-<Date.now()>`,
 * so every status change produced at least two notifications, and every re-sent PATCH that merely
 * *contained* a rider/waiter produced another "assigned" notification. One id per (order, event) +
 * `ON CONFLICT DO NOTHING` on insert means each event can exist only once.
 */
export type OrderNotificationEvent =
  | { kind: 'placed' }
  | { kind: 'kitchen' }
  | { kind: 'status'; status: string }
  | { kind: 'waiter'; waiterId?: string | null }
  | { kind: 'rider'; riderId?: string | null; accepted?: boolean }
  | { kind: 'paid' };

/** completed / delivered / taken are the same "order finished" moment for notification purposes. */
export function normalizeStatusForNotification(status: string): string {
  return status === 'delivered' || status === 'taken' ? 'completed' : status;
}

export function orderNotificationId(orderId: string, event: OrderNotificationEvent): string {
  switch (event.kind) {
    case 'placed':
      return `notif-placed-${orderId}`; // historical format, kept for compatibility
    case 'kitchen':
      return `notif-${orderId}-kitchen`;
    case 'status':
      return `notif-${orderId}-status-${normalizeStatusForNotification(event.status)}`;
    case 'waiter':
      return `notif-${orderId}-waiter-${event.waiterId || 'any'}`;
    case 'rider':
      return `notif-${orderId}-rider-${event.accepted ? 'accepted-' : ''}${event.riderId || 'any'}`;
    case 'paid':
      return `notif-${orderId}-paid`;
  }
}

/** Deterministic id for branch open/close announcements (one per branch per state change minute). */
export function branchStatusNotificationId(branchId: string, isOpen: boolean, at: Date = new Date()): string {
  const minute = at.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `notif-branch-${branchId}-${isOpen ? 'open' : 'closed'}-${minute}`;
}
