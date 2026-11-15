import { z } from 'zod';

export const emailAuthRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('send'),
    email: z.string().email('Valid email address is required'),
    clientMailConfig: z
      .object({
        accountEmail: z.string().email().optional(),
        accountApiKey: z.string().min(8).optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.union([z.string(), z.number()]).optional(),
      })
      .optional(),
  }),
  z.object({
    action: z.literal('verify'),
    email: z.string().email('Valid email address is required'),
    code: z.string().min(4, 'Code must be at least 4 digits').max(6),
    emailToken: z.string().optional(),
  }),
  z.object({
    action: z.literal('test_account'),
    email: z.string().email().optional(),
    clientMailConfig: z
      .object({
        accountEmail: z.string().email().optional(),
        accountApiKey: z.string().min(8).optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.union([z.string(), z.number()]).optional(),
      })
      .optional(),
  }),
  z.object({
    action: z.literal('save_server_config'),
    accountEmail: z.string().email('Valid email address is required'),
    accountApiKey: z.string().min(8, 'API key or App Password is required'),
    emailFrom: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.union([z.string(), z.number()]).optional(),
  }),
]);

export const staffLoginSchema = z.object({
  identifier: z.string().min(3, 'Email or phone number is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

export const customerOtpLoginSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid Pakistani phone number required'),
});

