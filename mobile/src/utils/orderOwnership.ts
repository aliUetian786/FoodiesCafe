// Strict "does this order belong to the signed-in customer?" check.
// An order owned by an account (real customerId or customerEmail) is shown ONLY to
// that account. Phone matches apply solely to unowned guest orders. Matching on
// customer name or phone for owned orders made the same order appear in two
// different accounts' history. Mirror: app/src/lib/orderOwnership.ts

export const isGuestCustomerId = (id?: string | null): boolean =>
  !id ||
  id === 'user-guest' ||
  id === 'guest' ||
  id === 'cust-guest' ||
  id === 'walk-in-customer' ||
  id.startsWith('guest');

export const normalizeOrderPhone = (p?: string | null): string => (p || '').replace(/\D/g, '').slice(-10);

export interface CustomerIdentity {
  ids: Array<string | null | undefined>;
  emails: Array<string | null | undefined>;
  phone?: string | null;
  devicePlacedIds?: string[];
}

export const orderBelongsToCustomer = (
  o: { id: string; orderNumber?: string; customerId?: string; customerEmail?: string; customerPhone?: string },
  who: CustomerIdentity
): boolean => {
  const ids = who.ids.filter((id): id is string => Boolean(id) && !isGuestCustomerId(id));
  const emails = who.emails.map((e) => (e || '').trim().toLowerCase()).filter(Boolean);

  if (o.customerId && ids.includes(o.customerId)) return true;
  const orderEmail = (o.customerEmail || '').trim().toLowerCase();
  if (orderEmail && emails.includes(orderEmail)) return true;

  if (orderEmail || !isGuestCustomerId(o.customerId)) return false;

  const phone = normalizeOrderPhone(who.phone);
  if (phone && normalizeOrderPhone(o.customerPhone) === phone) return true;
  const placed = who.devicePlacedIds || [];
  return placed.includes(o.id) || Boolean(o.orderNumber && placed.includes(o.orderNumber));
};
