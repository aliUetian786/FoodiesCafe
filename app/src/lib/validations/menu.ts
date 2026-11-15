import { z } from 'zod';

export const menuItemUpdateSchema = z.object({
  id: z.string().min(1, 'Dish ID is required'),
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  description: z.string().max(1000).optional(),
  isAvailable: z.boolean().optional(),
  branchAvailability: z.record(z.string(), z.boolean()).optional(),
  branchPriceOverrides: z.record(z.string(), z.number().nonnegative()).optional(),
  image: z.string().optional(),
});

export const dishAvailabilityToggleSchema = z.object({
  dishId: z.string().min(1, 'Dish ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  isAvailable: z.boolean(),
});

