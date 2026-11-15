import { z } from 'zod';

export const orderItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  menuItemId: z.string().min(1, 'Menu Item ID is required'),
  name: z.string().min(1, 'Item name is required'),
  size: z.string().optional(),
  extras: z.array(z.string()).optional(),
  instructions: z.string().max(500).optional(),
  unitPrice: z.number().nonnegative('Unit price must be positive or zero').optional().default(0),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  isAddOn: z.boolean().optional(),
  addedAtStage: z.enum(['stage1', 'stage2']).optional(),
});

export const orderTypeSchema = z.enum(['dine_in', 'takeaway', 'delivery']);

export const orderStatusSchema = z.enum([
  'placed',
  'accepted',
  'preparing',
  'ready',
  'served',
  'out_for_delivery',
  'completed',
  'cancelled',
  'delivered',
  'taken',
]);

export const paymentStatusSchema = z.enum(['unpaid', 'paid', 'partially_refunded', 'refunded']);

export const createOrderSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
  orderNumber: z.string().min(1, 'Order Number is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  customerId: z.string().optional().default('user-guest'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(1, 'Phone number is required'),
  customerEmail: z.string().nullable().optional(),
  type: orderTypeSchema,
  tableNumber: z.string().nullable().optional(),
  tablePin: z.string().nullable().optional(),
  pickupTime: z.string().nullable().optional(),
  status: orderStatusSchema.default('placed'),
  paymentStatus: paymentStatusSchema.default('unpaid'),
  paymentMethod: z.string().default('Cash'),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  originalSubtotal: z.number().nonnegative().optional(),
  addOnSubtotal: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  total: z.number().nonnegative().optional().default(0),
  createdAt: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  deliveryAddress: z.string().max(1000).nullable().optional(),
  version: z.number().int().default(1),
  sentToKitchen: z.boolean().default(false),
  sentToKitchenAt: z.string().nullable().optional(),
  forwardToKitchenAt: z.string().nullable().optional(),
  autoForwardCustomMin: z.number().int().nullable().optional(),
  cashierId: z.string().nullable().optional(),
  cashierName: z.string().nullable().optional(),
  isWalkIn: z.boolean().default(false),
  assignedRiderId: z.string().nullable().optional(),
  assignedRiderName: z.string().nullable().optional(),
  riderStatus: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  paymentCollected: z.boolean().default(false),
  customerCoordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .nullable()
    .optional(),
  assignedWaiterId: z.string().nullable().optional(),
  assignedWaiterName: z.string().nullable().optional(),
  isTableQr: z.boolean().default(false),
  waiterNotified: z.boolean().default(false),
  idempotencyKey: z.string().max(128).nullable().optional(),
  actorId: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
  actorRole: z.string().nullable().optional(),
});

export const updateOrderSchema = z.object({
  id: z.string().optional(),
  orderId: z.string().optional(),
  branchId: z.string().optional(),
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  paymentMethod: z.string().optional(),
  sentToKitchen: z.boolean().optional(),
  sentToKitchenAt: z.string().nullable().optional(),
  forwardToKitchenAt: z.string().nullable().optional(),
  autoForwardCustomMin: z.number().int().nullable().optional(),
  preparationStartedAt: z.string().nullable().optional(),
  readyTimeEstimated: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  cashierId: z.string().nullable().optional(),
  cashierName: z.string().nullable().optional(),
  isWalkIn: z.boolean().optional(),
  paymentCollected: z.boolean().optional(),
  assignedRiderId: z.string().nullable().optional(),
  assignedRiderName: z.string().nullable().optional(),
  riderStatus: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  customerCoordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .nullable()
    .optional(),
  assignedWaiterId: z.string().nullable().optional(),
  assignedWaiterName: z.string().nullable().optional(),
  isTableQr: z.boolean().optional(),
  waiterNotified: z.boolean().optional(),
  items: z.array(orderItemSchema).optional(),
  total: z.number().nonnegative().optional(),
  originalSubtotal: z.number().nonnegative().optional(),
  addOnSubtotal: z.number().nonnegative().optional(),
  notes: z.string().max(1000).nullable().optional(),
  version: z.number().int().optional(),
  expectedVersion: z.number().int().optional(),
  actorId: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
  actorRole: z.string().nullable().optional(),
});
