import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import type { UserRole } from '../types.js';

const listUsersSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
  })
  .transform(({ page, pageSize, search }) => ({
    page,
    pageSize,
    search,
  }));

const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'USER']),
});

type AdminUserRecord = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date | null;
};

const adminUserSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

function mapAdminUser(user: AdminUserRecord) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

export const adminRouter = express.Router();

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const params = listUsersSchema.parse(req.query);
    const skip = (params.page - 1) * params.pageSize;
    const where = params.search
      ? { email: { contains: params.search, mode: 'insensitive' as const } }
      : undefined;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.pageSize,
        select: adminUserSelect,
      } as any),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      data: (users as AdminUserRecord[]).map(mapAdminUser),
      page: params.page,
      pageSize: params.pageSize,
      total,
    });
  }),
);

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const targetId = req.params.id;

    if (targetId === req.user?.id && body.role !== req.user.role) {
      res.status(400).json({ error: 'You cannot change your own role.' });
      return;
    }

    const existing = (await prisma.user.findUnique({
      where: { id: targetId },
      select: adminUserSelect,
    } as any)) as AdminUserRecord | null;

    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (existing.role === body.role) {
      res.status(200).json(mapAdminUser(existing));
      return;
    }

    const updated = (await prisma.user.update({
      where: { id: targetId },
      data: { role: body.role },
      select: adminUserSelect,
    } as any)) as AdminUserRecord;

    res.status(200).json(mapAdminUser(updated));
  }),
);
