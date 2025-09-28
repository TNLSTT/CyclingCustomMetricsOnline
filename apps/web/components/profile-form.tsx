'use client';

import { useState } from 'react';

import { updateProfile } from '../lib/api';
import type { Profile } from '../types/profile';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
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
  const [location, setLocation] = useState(profile?.location ?? '');
  const [primaryDiscipline, setPrimaryDiscipline] = useState(profile?.primaryDiscipline ?? '');
  const [trainingFocus, setTrainingFocus] = useState(profile?.trainingFocus ?? '');
  const [favoriteRide, setFavoriteRide] = useState(profile?.favoriteRide ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(profile?.websiteUrl ?? '');
  const [instagramHandle, setInstagramHandle] = useState(profile?.instagramHandle ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const disciplineOptions = [
    'Road',
    'Gravel',
    'Mountain',
    'Track',
    'Cyclocross',
    'Triathlon',
    'Commuting',
    'Indoor',
  ];

  function normalizeField(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const updates = {
        displayName: normalizeField(displayName),
        avatarUrl: normalizeField(avatarUrl),
        bio: normalizeField(bio),
        location: normalizeField(location),
        primaryDiscipline: normalizeField(primaryDiscipline),
        trainingFocus: normalizeField(trainingFocus),
        favoriteRide: normalizeField(favoriteRide),
        websiteUrl: normalizeField(websiteUrl),
        instagramHandle: normalizeField(instagramHandle),
      };

      const updated = await updateProfile(updates, authToken);
      setDisplayName(updated.displayName ?? '');
      setAvatarUrl(updated.avatarUrl ?? '');
      setBio(updated.bio ?? '');
      setLocation(updated.location ?? '');
      setPrimaryDiscipline(updated.primaryDiscipline ?? '');
      setTrainingFocus(updated.trainingFocus ?? '');
      setFavoriteRide(updated.favoriteRide ?? '');
      setWebsiteUrl(updated.websiteUrl ?? '');
      setInstagramHandle(updated.instagramHandle ?? '');
      setSuccess('Profile updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const previewName = displayName.trim().length > 0 ? displayName.trim() : 'Your display name';
  const previewInitial = previewName.charAt(0).toUpperCase() || '?';
  const previewBio = bio.trim().length > 0 ? bio.trim() : 'Add a short bio to let others know what you love about riding.';
  const previewLocation = location.trim().length > 0 ? location.trim() : null;
  const previewDiscipline = primaryDiscipline.trim().length > 0 ? primaryDiscipline.trim() : null;
  const previewFocus = trainingFocus.trim().length > 0 ? trainingFocus.trim() : null;
  const previewFavorite = favoriteRide.trim().length > 0 ? favoriteRide.trim() : null;
  const previewWebsite = websiteUrl.trim().length > 0 ? websiteUrl.trim() : null;
  const previewInstagram = instagramHandle.trim().length > 0 ? instagramHandle.trim() : null;
  const previewAvatar = avatarUrl.trim().length > 0 ? avatarUrl.trim() : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Profile details</CardTitle>
        <CardDescription>
          Control how your identity appears across the app and showcase the rides that define you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
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
                  <p className="text-xs text-muted-foreground">
                    Shown on activity uploads and community leaderboards.
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Optional square image that personalizes your activity cards.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground" htmlFor="location">
                    Location
                  </label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="e.g. Girona, Spain"
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Highlight your home base or favorite riding region.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground" htmlFor="primaryDiscipline">
                    Primary discipline
                  </label>
                  <select
                    id="primaryDiscipline"
                    value={primaryDiscipline}
                    onChange={(event) => setPrimaryDiscipline(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select your specialty</option>
                    {disciplineOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Choose the riding style that best describes you.
                  </p>
                </div>
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
                <p className="text-xs text-muted-foreground">
                  Up to 1,000 characters about your riding story, team, or goals.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground" htmlFor="trainingFocus">
                    Training focus
                  </label>
                  <textarea
                    id="trainingFocus"
                    value={trainingFocus}
                    onChange={(event) => setTrainingFocus(event.target.value)}
                    rows={3}
                    maxLength={500}
                    className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Summarize what you’re working on this season.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground" htmlFor="favoriteRide">
                    Signature ride or achievement
                  </label>
                  <textarea
                    id="favoriteRide"
                    value={favoriteRide}
                    onChange={(event) => setFavoriteRide(event.target.value)}
                    rows={3}
                    maxLength={280}
                    className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Celebrate a race result, KOM, or route you’re proud of.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground" htmlFor="websiteUrl">
                    Website or training journal
                  </label>
                  <Input
                    id="websiteUrl"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="https://mycoachingsite.com"
                    maxLength={2048}
                  />
                  <p className="text-xs text-muted-foreground">
                    Link to your blog, team page, or coaching services.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground" htmlFor="instagramHandle">
                    Instagram handle
                  </label>
                  <Input
                    id="instagramHandle"
                    value={instagramHandle}
                    onChange={(event) => setInstagramHandle(event.target.value)}
                    placeholder="@rideandrepeat"
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Share where people can follow your training journey.
                  </p>
                </div>
              </div>
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

          <aside className="space-y-4 rounded-lg border bg-muted/30 p-6">
            <div className="flex items-center gap-4">
              {previewAvatar ? (
                <div className="h-16 w-16 overflow-hidden rounded-full border border-muted-foreground/20 bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewAvatar}
                    alt={`${previewName} avatar preview`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-muted-foreground/20 bg-muted text-lg font-semibold">
                  {previewInitial}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-foreground">{previewName}</p>
                {previewLocation ? (
                  <p className="text-sm text-muted-foreground">{previewLocation}</p>
                ) : null}
                {previewDiscipline ? (
                  <Badge variant="outline" className="mt-2">
                    {previewDiscipline}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="whitespace-pre-line text-foreground">{previewBio}</p>
              {previewFocus ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    Training focus
                  </p>
                  <p className="text-foreground">{previewFocus}</p>
                </div>
              ) : null}
              {previewFavorite ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    Signature ride
                  </p>
                  <p className="text-foreground">{previewFavorite}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 text-sm">
              {previewWebsite ? (
                <a
                  href={previewWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-medium text-primary hover:underline"
                >
                  {previewWebsite}
                </a>
              ) : null}
              {previewInstagram ? (
                <p className="text-muted-foreground">Follow on {previewInstagram}</p>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              This live preview updates as you craft your story so teammates and coaches instantly get a sense
              of who you are.
            </p>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}
