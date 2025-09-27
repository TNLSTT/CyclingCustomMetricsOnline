import { getServerSession } from 'next-auth';

import { authOptions } from './auth-options';
import { env } from './env';

export async function getServerAuthSession() {
  if (!env.authEnabled) {
    return null;
  }
  return getServerSession(authOptions);
}
