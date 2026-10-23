import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/** Middleware de validação de body com Zod. Substitui req.body pelo dado parseado. */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || '(body)',
        message: i.message,
      }));
      return res.status(400).json({ error: 'Dados inválidos', details });
    }
    req.body = result.data;
    next();
  };
}

const idSchema = z.string().min(1).max(100);
const emailSchema = z.string().trim().toLowerCase().email().max(255);

// --- Auth ---

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  password: z.string().min(6).max(200),
  role: z.string().max(150).optional(),
  department: z.string().max(150).optional(),
  weeklyCapacityHours: z.number().min(0).max(168).optional(),
});

// --- Reset (destructivo, exige confirmação explícita) ---

export const resetDatabaseSchema = z.object({
  confirm: z.literal('RESET'),
});

// --- App settings ---

export const appSettingSchema = z.object({
  value: z.unknown(),
});

// --- Members ---

export const memberCreateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  avatar: z.string().max(10000).optional(),
  role: z.string().max(150).optional(),
  department: z.string().max(150).optional(),
  weeklyCapacityHours: z.number().min(0).max(168).optional(),
  active: z.boolean().optional(),
});

export const memberUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    email: emailSchema.optional(),
    avatar: z.string().max(10000).optional(),
    role: z.string().max(150).optional(),
    department: z.string().max(150).optional(),
    weeklyCapacityHours: z.number().min(0).max(168).optional(),
    active: z.boolean().optional(),
  })
  .passthrough();

// --- Board ---

const columnSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(100),
  order: z.number().int().min(0),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  accentColor: z.string().max(50).optional(),
});

const epicSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(255),
  color: z.string().max(50).optional(),
});

export const boardCreateSchema = z.object({
  id: idSchema,
  key: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(5000).optional(),
  sprintName: z.string().max(255).optional(),
  sprintGoal: z.string().max(5000).optional(),
  sprintStartDate: z.string().max(50).optional(),
  sprintEndDate: z.string().max(50).optional(),
  columns: z.array(columnSchema).max(30).optional(),
  epics: z.array(epicSchema).max(100).optional(),
});

export const boardUpdateSchema = boardCreateSchema.partial().passthrough();

// --- Board columns (item 1.1) ---

export const columnCreateSchema = z.object({
  title: z.string().trim().min(1).max(100),
  accentColor: z.string().max(50).optional(),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  isDone: z.boolean().optional(),
  version: z.number().int().min(1),
});

export const columnUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    accentColor: z.string().max(50).optional(),
    wipLimit: z.number().int().min(1).max(999).nullable().optional(),
    isDone: z.boolean().optional(),
    version: z.number().int().min(1),
  })
  .refine((v) => Object.keys(v).some((k) => k !== 'version'), {
    message: 'Nada para atualizar',
  });

export const columnReorderSchema = z.object({
  order: z.array(z.string().min(1).max(100)).min(1).max(30),
  version: z.number().int().min(1),
});

// --- Tasks (merge server-side já saneia; valida só campos críticos no create) ---

export const taskCreateSchema = z
  .object({
    id: idSchema,
    key: z.string().trim().min(1).max(50),
    boardId: idSchema,
    title: z.string().trim().min(1).max(500),
    issueType: z.string().min(1).max(50),
    priority: z.string().min(1).max(50),
    statusId: z.string().min(1).max(100),
  })
  .passthrough();

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    statusId: z.string().min(1).max(100).optional(),
  })
  .passthrough();

// --- Email settings ---

export const emailSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    senderEmail: z.string().max(255).optional(),
    senderName: z.string().max(255).optional(),
    notifyOnStatusChange: z.boolean().optional(),
    notifyOnMentions: z.boolean().optional(),
    notifyReporterOnDone: z.boolean().optional(),
  })
  .passthrough();

// --- Task attachments (item 2.1) ---

export const attachmentUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().min(1),
});

export const attachmentConfirmSchema = z.object({
  attachmentId: z.string().trim().min(1).max(100),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().min(1),
});

// --- Board members / permissões (item 5.1) ---

const boardRoleSchema = z.enum(['owner', 'editor', 'viewer']);
const permissionsOverrideSchema = z.record(z.boolean());

export const boardMemberInviteSchema = z.object({
  email: emailSchema,
  role: boardRoleSchema.optional(),
  permissions: permissionsOverrideSchema.optional(),
});

export const boardMemberPatchSchema = z
  .object({
    role: boardRoleSchema.optional(),
    permissions: permissionsOverrideSchema.optional(),
  })
  .refine((v) => v.role !== undefined || v.permissions !== undefined, {
    message: 'Informe role ou permissions',
  });
