import type { DefaultSession } from 'next-auth';

import type { UserRole } from './admin';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user?: DefaultSession['user'] & {
      id?: string;
      role?: UserRole;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    role?: UserRole;
  }
}
