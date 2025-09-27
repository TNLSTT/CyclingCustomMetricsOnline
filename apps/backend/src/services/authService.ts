import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

import { env } from '../env.js';
import { prisma } from '../prisma.js';
import type { AuthenticatedUser } from '../types.js';

const SALT_ROUNDS = 10;

interface AuthResult {
  user: AuthenticatedUser & { createdAt: Date };
  token: string;
}

function mapUser(user: { id: string; email: string; createdAt: Date }): AuthenticatedUser & {
  createdAt: Date;
} {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function signToken(user: { id: string; email: string }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
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
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      provider: 'credentials',
    },
  });

  return {
    user: mapUser(user),
    token: signToken(user),
  };
}

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  return {
    user: mapUser(user),
    token: signToken(user),
  };
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }

  const { sub, email } = decoded as JwtPayload;
  if (!sub) {
    throw new Error('Invalid token subject');
  }

  return {
    id: sub,
    email: typeof email === 'string' ? email : undefined,
  };
}
