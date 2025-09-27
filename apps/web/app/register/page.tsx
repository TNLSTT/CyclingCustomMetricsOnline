import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RegisterForm } from '../../components/register-form';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';

export default async function RegisterPage() {
  if (!env.authEnabled) {
    redirect('/');
  }

  const session = await getServerAuthSession();
  if (session) {
    redirect('/activities');
  }

  return (
    <div className="mx-auto flex max-w-md flex-col space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Register to keep your uploads and metrics private to your login.
        </p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/signin" className="text-primary underline">
          Sign in instead
        </Link>
        .
      </p>
    </div>
  );
}
