import type { AuthenticatedUser } from '../types.js';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
