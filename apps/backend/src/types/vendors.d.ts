declare module 'bcryptjs' {
  export function hash(data: string, salt: number | string): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: unknown;
    sub?: string;
    email?: string;
  }

  export interface SignOptions {
    expiresIn?: string | number;
  }

  export function sign(
    payload: string | Buffer | Record<string, unknown>,
    secretOrPrivateKey: string,
    options?: SignOptions,
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string,
  ): string | JwtPayload;
}
