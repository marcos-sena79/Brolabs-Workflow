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
  key: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(255),
  color: z.string().max(50).optional(),
  description: z.string().max(5000).optional(),
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
    assigneeIds: z.array(z.string().min(1).max(100)).max(100).optional(),
    parentId: z.string().trim().min(1).max(100).optional(),
  })
  .passthrough();

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    statusId: z.string().min(1).max(100).optional(),
    assigneeIds: z.array(z.string().min(1).max(100)).max(100).optional(),
    parentId: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .passthrough();

// --- Integrações / webhooks (S2, item 5) ---

export const integrationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    webhookUrl: z.union([z.string().trim().max(2048), z.literal('')]).optional(),
    channelName: z.string().trim().max(150).optional(),
    notifyOnTaskComplete: z.boolean().optional(),
    notifyOnWorklog: z.boolean().optional(),
    notifyOnTaskBlocked: z.boolean().optional(),
    notifyOnSprintStart: z.boolean().optional(),
    notifyOnMention: z.boolean().optional(),
    notifyOnAssignment: z.boolean().optional(),
    memberHandles: z.record(z.string().max(100), z.string().max(100)).optional(),
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

// --- E-mail (item 3.1) ---

export const emailTestSchema = z.object({
  to: emailSchema,
});

// --- Preferências do membro (itens 3.3 / 5.4) ---

export const memberPreferencesSchema = z
  .object({
    soundEnabled: z.boolean().optional(),
    soundVolume: z.number().min(0).max(1).optional(),
    soundEvent: z.enum(['none', 'soft', 'digital']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada para atualizar' });

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

// --- To-Do do dia (item 2.4) ---

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use YYYY-MM-DD)')
  .refine((v) => {
    const t = new Date(`${v}T00:00:00Z`).getTime();
    if (Number.isNaN(t)) return false;
    const now = Date.now();
    const twoYears = 366 * 24 * 60 * 60 * 1000 * 2;
    return t >= now - twoYears && t <= now + twoYears;
  }, 'Data fora do intervalo razoável (±2 anos)');

export const todoCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueDate: isoDate.optional(),
  boardId: idSchema.optional(),
  sourceTaskId: idSchema.optional(),
});

export const todoUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    done: z.boolean().optional(),
    dueDate: isoDate.optional(),
    position: z.number().int().min(0).max(10000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada para atualizar' });

export const todoListQuerySchema = z.object({
  date: isoDate.optional(),
});

// --- Notas + IA (item 4.1) ---

export const noteCreateSchema = z.object({
  boardId: idSchema,
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().max(50000).optional(),
});

export const noteUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().max(50000).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada para atualizar' });

export const noteAiSchema = z.object({
  action: z.enum(['summarize', 'expand', 'action_items']),
});

export const noteFromSprintSchema = z.object({
  boardId: idSchema,
});

// --- Board público/privado (item 1.2) ---

export const shareCreateSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

// --- Etiquetas globais (item 2.2) ---

const tagNameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1).max(60));

const tagColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)');

export const tagCreateSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema.optional(),
});

export const tagUpdateSchema = z
  .object({
    name: tagNameSchema.optional(),
    color: tagColorSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: 'Informe name ou color',
  });
