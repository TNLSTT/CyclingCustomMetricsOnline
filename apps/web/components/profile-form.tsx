'use client';

import { useEffect, useMemo, useState } from 'react';

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

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'CM';
  }
  const matches = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return matches.slice(0, 2) || 'CM';
}

function formatLinkLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.host.replace(/^www\./, '');
  } catch (error) {
    return url;
  }
}

export function ProfileForm({ profile, authToken }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [primaryDiscipline, setPrimaryDiscipline] = useState(profile?.primaryDiscipline ?? '');
  const [trainingFocus, setTrainingFocus] = useState(profile?.trainingFocus ?? '');
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(
    profile?.weeklyGoalHours != null ? String(profile.weeklyGoalHours) : '',
  );
  const [websiteUrl, setWebsiteUrl] = useState(profile?.websiteUrl ?? '');
  const [instagramHandle, setInstagramHandle] = useState(profile?.instagramHandle ?? '');
  const [achievements, setAchievements] = useState(profile?.achievements ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [avatarUrl]);

  const previewWeeklyGoalHours = useMemo(() => {
    if (weeklyGoalHours.trim().length === 0) {
      return null;
    }
    const value = Number(weeklyGoalHours);
    return Number.isFinite(value) ? value : null;
  }, [weeklyGoalHours]);

  const parsedAchievements = useMemo(
    () =>
      achievements
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [achievements],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    const trimmedDisplayName = displayName.trim();
    const trimmedAvatarUrl = avatarUrl.trim();
    const trimmedBio = bio.trim();
    const trimmedLocation = location.trim();
    const trimmedPrimaryDiscipline = primaryDiscipline.trim();
    const trimmedTrainingFocus = trainingFocus.trim();
    const trimmedWebsiteUrl = websiteUrl.trim();
    const trimmedInstagram = instagramHandle.trim().replace(/^@+/, '');
    const trimmedAchievements = achievements.trim();

    let parsedWeeklyGoal: number | null = null;
    if (weeklyGoalHours.trim().length > 0) {
      const value = Number(weeklyGoalHours);
      if (!Number.isFinite(value)) {
        setError('Weekly training goal must be a number.');
        setIsSaving(false);
        return;
      }
      if (!Number.isInteger(value)) {
        setError('Weekly training goal must be a whole number of hours.');
        setIsSaving(false);
        return;
      }
      if (value < 0 || value > 80) {
        setError('Weekly training goal must be between 0 and 80 hours.');
        setIsSaving(false);
        return;
      }
      parsedWeeklyGoal = value;
    }

    try {
      const updates = {
        displayName: trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
        avatarUrl: trimmedAvatarUrl.length > 0 ? trimmedAvatarUrl : null,
        bio: trimmedBio.length > 0 ? trimmedBio : null,
        location: trimmedLocation.length > 0 ? trimmedLocation : null,
        primaryDiscipline:
          trimmedPrimaryDiscipline.length > 0 ? trimmedPrimaryDiscipline : null,
        trainingFocus: trimmedTrainingFocus.length > 0 ? trimmedTrainingFocus : null,
        weeklyGoalHours: parsedWeeklyGoal,
        websiteUrl: trimmedWebsiteUrl.length > 0 ? trimmedWebsiteUrl : null,
        instagramHandle: trimmedInstagram.length > 0 ? trimmedInstagram : null,
        achievements: trimmedAchievements.length > 0 ? trimmedAchievements : null,
      };

      const updated = await updateProfile(updates, authToken);
      setDisplayName(updated.displayName ?? '');
      setAvatarUrl(updated.avatarUrl ?? '');
      setBio(updated.bio ?? '');
      setLocation(updated.location ?? '');
      setPrimaryDiscipline(updated.primaryDiscipline ?? '');
      setTrainingFocus(updated.trainingFocus ?? '');
      setWeeklyGoalHours(
        updated.weeklyGoalHours != null ? String(updated.weeklyGoalHours) : '',
      );
      setWebsiteUrl(updated.websiteUrl ?? '');
      setInstagramHandle(updated.instagramHandle ?? '');
      setAchievements(updated.achievements ?? '');
      setSuccess('Profile updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="max-w-5xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Customize your training identity</CardTitle>
        <CardDescription>
          Add personality, goals, and social links to help teammates understand your focus and celebrate
          your milestones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Profile details</CardTitle>
                  <CardDescription>Control how your name, photo, and story appear across the app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <p className="text-xs text-muted-foreground">Shown on activity uploads, leaderboards, and charts.</p>
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
                    <p className="text-xs text-muted-foreground">Square images look best. We recommend at least 200×200px.</p>
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
                    <p className="text-xs text-muted-foreground">Up to 1,000 characters about your training goals and coaching philosophy.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Personal details</CardTitle>
                  <CardDescription>Share context about how and where you love to ride.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="location">
                      Home base
                    </label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="Portland, OR"
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">Let training partners know where to meet for the next ride.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="primaryDiscipline">
                      Primary discipline
                    </label>
                    <Input
                      id="primaryDiscipline"
                      value={primaryDiscipline}
                      onChange={(event) => setPrimaryDiscipline(event.target.value)}
                      placeholder="Climbing, time trial, gravel, etc."
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">Highlight the style of riding that fuels your training.</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="trainingFocus">
                      Current training focus
                    </label>
                    <Input
                      id="trainingFocus"
                      value={trainingFocus}
                      onChange={(event) => setTrainingFocus(event.target.value)}
                      placeholder="Build tempo for spring stage races"
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground">Helps teammates understand what metrics matter most to you.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Goals & highlights</CardTitle>
                  <CardDescription>Track weekly volume targets and celebrate standout efforts.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="weeklyGoalHours">
                      Weekly training goal (hours)
                    </label>
                    <Input
                      id="weeklyGoalHours"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={80}
                      step={1}
                      value={weeklyGoalHours}
                      onChange={(event) => setWeeklyGoalHours(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Set a target to stay accountable. Whole hours between 0 and 80.</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="achievements">
                      Recent highlights
                    </label>
                    <textarea
                      id="achievements"
                      value={achievements}
                      onChange={(event) => setAchievements(event.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder={"Winter base camp ✔\nFirst 300W FTP test ✔"}
                      className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">One accomplishment per line will display as a list on your public card.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Social connections</CardTitle>
                  <CardDescription>Invite others to follow your journey beyond Cycling Custom Metrics.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="websiteUrl">
                      Personal site or coaching link
                    </label>
                    <Input
                      id="websiteUrl"
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="https://myteam.cc"
                      maxLength={2048}
                    />
                    <p className="text-xs text-muted-foreground">Share a blog, team homepage, or favorite route collection.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="instagramHandle">
                      Instagram handle
                    </label>
                    <Input
                      id="instagramHandle"
                      value={instagramHandle}
                      onChange={(event) => setInstagramHandle(event.target.value)}
                      placeholder="@climbs.with.coffee"
                      maxLength={60}
                    />
                    <p className="text-xs text-muted-foreground">Add without the @ symbol—we&apos;ll display it for you.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Profile preview</CardTitle>
                  <CardDescription>How teammates will see your card across the app.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-muted">
                        {avatarUrl.trim().length > 0 && !avatarPreviewError ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt="Profile avatar preview"
                            className="h-full w-full object-cover"
                            onError={() => setAvatarPreviewError(true)}
                          />
                        ) : (
                          <span className="text-lg font-semibold text-muted-foreground">
                            {getInitials(displayName || 'Cycling Metric')}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {displayName.trim().length > 0
                            ? displayName
                            : 'Cycling Custom Metrics athlete'}
                        </p>
                        {location.trim().length > 0 ? (
                          <p className="text-sm text-muted-foreground">{location}</p>
                        ) : null}
                        {primaryDiscipline.trim().length > 0 || trainingFocus.trim().length > 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {[primaryDiscipline, trainingFocus].filter((item) => item.trim().length > 0).join(' • ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                      {bio.trim().length > 0
                        ? bio
                        : 'Share your story, goals, and favorite climbs so training partners can cheer you on.'}
                    </div>
                    <dl className="grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="font-medium text-foreground">Weekly goal</dt>
                        <dd className="text-muted-foreground">
                          {previewWeeklyGoalHours != null
                            ? `${previewWeeklyGoalHours} hr${previewWeeklyGoalHours === 1 ? '' : 's'} / week`
                            : 'Set a target to stay accountable.'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Connections</dt>
                        <dd className="space-y-1 text-muted-foreground">
                          {websiteUrl.trim().length > 0 ? (
                            <a
                              href={websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-primary hover:underline"
                            >
                              {formatLinkLabel(websiteUrl)}
                            </a>
                          ) : (
                            <span>Link your site or blog.</span>
                          )}
                          {instagramHandle.trim().length > 0 ? (
                            <span>@{instagramHandle.trim().replace(/^@+/, '')}</span>
                          ) : (
                            <span>Add Instagram for training updates.</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Highlights</h4>
                      {parsedAchievements.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {parsedAchievements.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Celebrate podiums, epic routes, or training breakthroughs.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Tip</CardTitle>
                  <CardDescription>Keep details current for richer team analytics.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    We surface your profile on activity leaderboards and metric reports. When your goals and
                    focus are up to date, coaches can tailor insights to what matters most.
                  </p>
                  <p>
                    Highlights are perfect for milestone FTP tests, race podiums, or new endurance records—add a
                    new line whenever you hit a breakthrough.
                  </p>
                </CardContent>
              </Card>
            </aside>
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

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
