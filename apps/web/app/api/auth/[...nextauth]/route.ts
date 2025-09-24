import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { env } from '../../../../lib/env';

const demoEmail = process.env.DEMO_USER_EMAIL ?? 'demo@cyclingmetrics.dev';
const demoPassword = process.env.DEMO_USER_PASSWORD ?? 'demo';

const handler = NextAuth({
  providers: [
    Credentials({
      name: 'Demo Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', value: demoEmail },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!env.authEnabled) {
          return {
            id: 'demo-user',
            email: demoEmail,
            name: 'Demo Rider',
          };
        }
        if (
          credentials?.email === demoEmail &&
          credentials?.password === demoPassword
        ) {
          return {
            id: 'demo-user',
            email: demoEmail,
            name: 'Demo Rider',
          };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
