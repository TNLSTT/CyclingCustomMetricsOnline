import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RegisterForm } from '../../components/register-form';
import { PageHeader } from '../../components/page-header';
import { getServerAuthSession } from '../../lib/auth';
import { env } from '../../lib/env';

export default async function RegisterPage() {
  if (!env.authEnabled) {
    redirect('/');
  }

  const session = await getServerAuthSession();
  if (session) {
    redirect('/profile');
  }

  return (
    <div className="mx-auto flex max-w-md flex-col space-y-8">
      <PageHeader
        align="center"
        title="Create your account"
        description="Register to keep your uploads and metrics private to your login."
      />
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
