import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { env } from './env';
import type { UserRole } from '../types/admin';

const demoEmail = process.env.DEMO_USER_EMAIL ?? 'demo@cyclingmetrics.dev';
const demoPassword = process.env.DEMO_USER_PASSWORD ?? 'demo';

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', value: demoEmail },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const email = credentials.email.toLowerCase();

        if (!env.authEnabled) {
          if (email === demoEmail.toLowerCase() && credentials.password === demoPassword) {
            return {
              id: 'demo-user',
              email: demoEmail,
              name: 'Demo Rider',
              role: 'ADMIN' as UserRole,
              accessToken: 'demo-token',
            } as any;
          }
          return null;
        }

        try {
          const response = await fetch(`${env.internalApiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: credentials.password }),
          });

          if (!response.ok) {
            return null;
          }

          const data = (await response.json()) as {
            user: { id: string; email: string; role: UserRole };
            token: string;
          };

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.email,
            role: data.user.role,
            accessToken: data.token,
          } as any;
        } catch (error) {
          console.error('Failed to authenticate user', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as unknown as {
          accessToken?: string;
          email?: string;
          id: string;
          role?: UserRole;
        };
        if (authUser.accessToken) {
          token.accessToken = authUser.accessToken;
        }
        if (authUser.email) {
          token.email = authUser.email;
        }
        token.sub = authUser.id;
        if (authUser.role) {
          token.role = authUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        (session as any).accessToken = token.accessToken;
      }
      if (session.user && token?.sub) {
        (session.user as any).id = token.sub;
        session.user.email = (token.email as string | undefined) ?? session.user.email;
        if (token.role) {
          (session.user as any).role = token.role;
        }
      }
      return session;
    },
  },
  pages: env.authEnabled
    ? {
        signIn: '/signin',
      }
    : {},
  secret: process.env.NEXTAUTH_SECRET,
};
