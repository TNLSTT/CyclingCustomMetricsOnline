import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignInForm } from '../../components/sign-in-form';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';

export default async function SignInPage() {
  if (!env.authEnabled) {
    redirect('/');
  }

  const session = await getServerAuthSession();
  if (session) {
    redirect('/profile');
  }

  return (
    <div className="mx-auto flex max-w-md flex-col space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-bold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and password to access your cycling metrics.
        </p>
      </div>
      <SignInForm />
      <p className="text-center text-sm text-muted-foreground">
        Need an account?{' '}
        <Link href="/register" className="text-primary underline">
          Register now
        </Link>
        .
      </p>
    </div>
  );
}
