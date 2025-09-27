'use client';

import { useState } from 'react';

import { updateProfile } from '../lib/api';
import type { Profile } from '../types/profile';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

interface ProfileFormProps {
  profile: Profile | null;
  authToken?: string;
}

export function ProfileForm({ profile, authToken }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const updates = {
        displayName: displayName.trim().length > 0 ? displayName.trim() : null,
        avatarUrl: avatarUrl.trim().length > 0 ? avatarUrl.trim() : null,
        bio: bio.trim().length > 0 ? bio.trim() : null,
      };

      const updated = await updateProfile(updates, authToken);
      setDisplayName(updated.displayName ?? '');
      setAvatarUrl(updated.avatarUrl ?? '');
      setBio(updated.bio ?? '');
      setSuccess('Profile updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Profile details</CardTitle>
        <CardDescription>Control how your name and bio appear across the app.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="displayName">
              Display name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Climbs with Coffee"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">Shown on activity uploads and leaderboards.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="avatarUrl">
              Avatar URL
            </label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://example.com/avatar.jpg"
              maxLength={2048}
            />
            <p className="text-xs text-muted-foreground">Optional image used in future social features.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              maxLength={1000}
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">Up to 1,000 characters about your training goals.</p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {success ? (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
