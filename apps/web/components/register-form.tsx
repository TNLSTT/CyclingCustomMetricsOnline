'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { registerUserAccount } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) {
      score += 1;
    }
    if (password.length >= 12) {
      score += 1;
    }
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
      score += 1;
    }
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) {
      score += 1;
    }

    const clamped = Math.min(score, 4);
    const labels = ['Too short', 'Getting started', 'Good', 'Strong'];
    const helpText = [
      'Add at least 8 characters to get started.',
      'Mix upper & lower case letters for better security.',
      'Include numbers or symbols to strengthen your password.',
      'This password meets our strong recommendation.',
    ];

    return {
      score: clamped,
      label: labels[clamped],
      help: helpText[clamped],
    };
  }, [password]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Passwords must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedEmail = email.toLowerCase();
      await registerUserAccount(normalizedEmail, password);
      const result = await signIn('credentials', {
        redirect: false,
        email: normalizedEmail,
        password,
      });

      if (result?.error) {
        router.push('/signin');
        return;
      }

      router.push('/profile');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Register</CardTitle>
        <CardDescription>Create an account to manage your activities.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="pl-9"
                required
                aria-describedby="register-email-help"
              />
            </div>
            <p className="text-xs text-muted-foreground" id="register-email-help">
              Use a valid address—you will receive upload confirmations here.
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="pr-10 pl-9"
                required
                aria-describedby="password-strength-help"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                disabled={isSubmitting}
              >
                {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="space-y-1" id="password-strength-help">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`password-strength-${index}`}
                    className={`h-1 flex-1 rounded ${
                      index < passwordStrength.score ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{passwordStrength.label}.</span>{' '}
                {passwordStrength.help}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="confirm-password">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={isConfirmPasswordVisible ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="pr-10 pl-9"
                required
              />
              <button
                type="button"
                onClick={() => setIsConfirmPasswordVisible((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                aria-label={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
                disabled={isSubmitting}
              >
                {isConfirmPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error ? (
            <Alert variant="destructive" role="status" aria-live="assertive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
