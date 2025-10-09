import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

import { env } from '../env.js';
import { prisma } from '../prisma.js';
import type { AuthenticatedUser, UserRole } from '../types.js';

const SALT_ROUNDS = 10;

type AuthUserRecord = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date | null;
  passwordHash?: string | null;
};

interface AuthResult {
  user: AuthenticatedUser & { createdAt: Date; lastLoginAt: Date | null };
  token: string;
}

function mapUser(user: {
  id: string;
  email: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  role: UserRole;
}): AuthenticatedUser & {
  createdAt: Date;
  lastLoginAt: Date | null;
} {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function signToken(user: { id: string; email: string; role: UserRole }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export async function registerUser(email: string, password: string): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Email is already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = (await prisma.user.create({
    data: {
      email,
      passwordHash,
      provider: 'credentials',
      role: 'USER',
      lastLoginAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      role: true,
      lastLoginAt: true,
    },
  } as any)) as AuthUserRecord;

  return {
    user: mapUser(user),
    token: signToken(user),
  };
}

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const user = (await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
  } as any)) as (AuthUserRecord & { passwordHash?: string | null }) | null;
  if (!user || !user.passwordHash) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const updatedUser = (await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
  } as any)) as AuthUserRecord;

  return {
    user: mapUser(updatedUser),
    token: signToken(updatedUser),
  };
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }

  const { sub, email, role } = decoded as JwtPayload & { role?: string };
  if (!sub) {
    throw new Error('Invalid token subject');
  }

  if (role !== 'ADMIN' && role !== 'USER') {
    throw new Error('Invalid role claim');
  }

  return {
    id: sub,
    email: typeof email === 'string' ? email : undefined,
    role,
  };
}
