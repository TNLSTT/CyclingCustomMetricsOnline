'use client';

import { useEffect, useMemo, useState } from 'react';

import { updateProfile } from '../lib/api';
import type { Profile, ProfileTarget } from '../types/profile';
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

type TargetFormEntry = {
  id: string;
  name: string;
  date: string;
  durationHours: string;
  distanceKm: string;
  criticalDurationMinutes: string;
  criticalPowerWatts: string;
  targetAveragePowerWatts: string;
  notes: string;
};

const POWER_BEST_DESCRIPTORS = [
  { minutes: 1, label: '1-minute' },
  { minutes: 5, label: '5-minute' },
  { minutes: 20, label: '20-minute' },
  { minutes: 60, label: '60-minute' },
  { minutes: 180, label: '180-minute' },
  { minutes: 240, label: '240-minute' },
] as const;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function createTargetFormEntry(initial?: Partial<TargetFormEntry>): TargetFormEntry {
  return {
    id: initial?.id ?? generateId(),
    name: initial?.name ?? '',
    date: initial?.date ?? '',
    durationHours: initial?.durationHours ?? '',
    distanceKm: initial?.distanceKm ?? '',
    criticalDurationMinutes: initial?.criticalDurationMinutes ?? '',
    criticalPowerWatts: initial?.criticalPowerWatts ?? '',
    targetAveragePowerWatts: initial?.targetAveragePowerWatts ?? '',
    notes: initial?.notes ?? '',
  };
}

function mapTargetsToForm(targets: ProfileTarget[] | undefined): TargetFormEntry[] {
  if (!targets) {
    return [];
  }

  return targets.map((target) =>
    createTargetFormEntry({
      id: target.id,
      name: target.name,
      date:
        target.date && target.date.includes('T')
          ? target.date.slice(0, 10)
          : target.date ?? '',
      durationHours: target.durationHours != null ? String(target.durationHours) : '',
      distanceKm: target.distanceKm != null ? String(target.distanceKm) : '',
      criticalDurationMinutes:
        target.criticalEffort?.durationMinutes != null
          ? String(target.criticalEffort.durationMinutes)
          : '',
      criticalPowerWatts:
        target.criticalEffort?.powerWatts != null ? String(target.criticalEffort.powerWatts) : '',
      targetAveragePowerWatts:
        target.targetAveragePowerWatts != null ? String(target.targetAveragePowerWatts) : '',
      notes: target.notes ?? '',
    }),
  );
}

function mergePowerBests(bests?: Profile['powerBests']): Profile['powerBests'] {
  const map = new Map<number, number | null>();
  for (const entry of bests ?? []) {
    map.set(entry.durationMinutes, entry.watts ?? null);
  }

  return POWER_BEST_DESCRIPTORS.map((descriptor) => ({
    durationMinutes: descriptor.minutes,
    watts: map.get(descriptor.minutes) ?? null,
  }));
}

function parseNumberInput(
  value: string,
  label: string,
  options: { min?: number; max?: number; allowFloat?: boolean } = {},
): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number.`);
  }

  if (!options.allowFloat && !Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }

  if (options.min != null && parsed < options.min) {
    throw new Error(`${label} must be at least ${options.min}.`);
  }

  if (options.max != null && parsed > options.max) {
    throw new Error(`${label} must be ${options.max} or less.`);
  }

  return parsed;
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
  const [ftpWatts, setFtpWatts] = useState(profile?.ftpWatts != null ? String(profile.ftpWatts) : '');
  const [websiteUrl, setWebsiteUrl] = useState(profile?.websiteUrl ?? '');
  const [instagramHandle, setInstagramHandle] = useState(profile?.instagramHandle ?? '');
  const [achievements, setAchievements] = useState(profile?.achievements ?? '');
  const [events, setEvents] = useState<TargetFormEntry[]>(() => mapTargetsToForm(profile?.events));
  const [goals, setGoals] = useState<TargetFormEntry[]>(() => mapTargetsToForm(profile?.goals));
  const [strengths, setStrengths] = useState(profile?.strengths ?? '');
  const [weaknesses, setWeaknesses] = useState(profile?.weaknesses ?? '');
  const [powerBests, setPowerBests] = useState<Profile['powerBests']>(mergePowerBests(profile?.powerBests));
  const [weightKg, setWeightKg] = useState<number | null>(profile?.weightKg ?? null);
  const [hrMaxBpm, setHrMaxBpm] = useState<number | null>(profile?.hrMaxBpm ?? null);
  const [hrRestBpm, setHrRestBpm] = useState<number | null>(profile?.hrRestBpm ?? null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [avatarUrl]);

  useEffect(() => {
    setWeightKg(profile?.weightKg ?? null);
    setHrMaxBpm(profile?.hrMaxBpm ?? null);
    setHrRestBpm(profile?.hrRestBpm ?? null);
  }, [profile?.weightKg, profile?.hrMaxBpm, profile?.hrRestBpm]);

  const previewWeeklyGoalHours = useMemo(() => {
    if (weeklyGoalHours.trim().length === 0) {
      return null;
    }
    const value = Number(weeklyGoalHours);
    return Number.isFinite(value) ? value : null;
  }, [weeklyGoalHours]);

  const previewFtpWatts = useMemo(() => {
    if (ftpWatts.trim().length === 0) {
      return null;
    }
    const value = Number(ftpWatts);
    return Number.isFinite(value) ? value : null;
  }, [ftpWatts]);

  const parsedAchievements = useMemo(
    () =>
      achievements
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [achievements],
  );

  const parsedStrengths = useMemo(
    () =>
      strengths
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [strengths],
  );

  const parsedWeaknesses = useMemo(
    () =>
      weaknesses
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    [weaknesses],
  );

  const labelledPowerBests = useMemo(
    () =>
      POWER_BEST_DESCRIPTORS.map((descriptor) => ({
        label: descriptor.label,
        durationMinutes: descriptor.minutes,
        watts:
          powerBests.find((entry) => entry.durationMinutes === descriptor.minutes)?.watts ?? null,
      })),
    [powerBests],
  );

  const previewDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  const numberFormatters = useMemo(
    () => ({
      oneDecimal: new Intl.NumberFormat('en', { maximumFractionDigits: 1 }),
      whole: new Intl.NumberFormat('en', { maximumFractionDigits: 0 }),
    }),
    [],
  );

  function parseFloatOrNull(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatTargetSummary(entry: TargetFormEntry) {
    const pieces: string[] = [];
    const duration = parseFloatOrNull(entry.durationHours);
    if (duration != null) {
      pieces.push(`${numberFormatters.oneDecimal.format(duration)} hr${duration === 1 ? '' : 's'}`);
    }
    const distance = parseFloatOrNull(entry.distanceKm);
    if (distance != null) {
      pieces.push(`${numberFormatters.oneDecimal.format(distance)} km`);
    }
    const averagePower = parseFloatOrNull(entry.targetAveragePowerWatts);
    if (averagePower != null) {
      pieces.push(`Avg ${numberFormatters.whole.format(averagePower)} W`);
    }
    const criticalDuration = parseFloatOrNull(entry.criticalDurationMinutes);
    const criticalPower = parseFloatOrNull(entry.criticalPowerWatts);
    if (criticalDuration != null || criticalPower != null) {
      const effortParts: string[] = [];
      if (criticalDuration != null) {
        effortParts.push(`${numberFormatters.oneDecimal.format(criticalDuration)} min`);
      }
      if (criticalPower != null) {
        effortParts.push(`${numberFormatters.whole.format(criticalPower)} W`);
      }
      pieces.push(`CE ${effortParts.join(' @ ')}`);
    }
    return pieces.join(' • ');
  }

  function buildTargetPayload(entries: TargetFormEntry[], context: 'event' | 'goal'): ProfileTarget[] {
    const label = context === 'event' ? 'Event' : 'Goal';

    return entries.map((entry, index) => {
      const trimmedName = entry.name.trim();
      if (trimmedName.length === 0) {
        throw new Error(`${label} ${index + 1} needs a name.`);
      }

      const id = entry.id.trim().length > 0 ? entry.id : generateId();
      const dateValue = entry.date.trim();
      if (dateValue.length > 0 && Number.isNaN(Date.parse(dateValue))) {
        throw new Error(`${label} ${index + 1} needs a valid date (YYYY-MM-DD).`);
      }

      const durationHours = parseNumberInput(
        entry.durationHours,
        `${label} ${index + 1} duration (hours)`,
        { min: 0, max: 200, allowFloat: true },
      );
      const distanceKm = parseNumberInput(
        entry.distanceKm,
        `${label} ${index + 1} distance (km)`,
        { min: 0, max: 5000, allowFloat: true },
      );
      const criticalDuration = parseNumberInput(
        entry.criticalDurationMinutes,
        `${label} ${index + 1} critical effort duration (minutes)`,
        { min: 0, max: 600, allowFloat: true },
      );
      const criticalPower = parseNumberInput(
        entry.criticalPowerWatts,
        `${label} ${index + 1} critical effort power (watts)`,
        { min: 0, max: 2000, allowFloat: false },
      );
      const targetAveragePower = parseNumberInput(
        entry.targetAveragePowerWatts,
        `${label} ${index + 1} target average power (watts)`,
        { min: 0, max: 2000, allowFloat: false },
      );

      const notes = entry.notes.trim();

      return {
        id,
        name: trimmedName,
        date: dateValue.length > 0 ? dateValue : null,
        durationHours,
        distanceKm,
        criticalEffort:
          criticalDuration != null || criticalPower != null
            ? {
                durationMinutes: criticalDuration,
                powerWatts: criticalPower,
              }
            : null,
        targetAveragePowerWatts: targetAveragePower,
        notes: notes.length > 0 ? notes : null,
      } satisfies ProfileTarget;
    });
  }

  function handleAddEvent() {
    setEvents((prev) => [...prev, createTargetFormEntry()]);
  }

  function handleRemoveEvent(id: string) {
    setEvents((prev) => prev.filter((entry) => entry.id !== id));
  }

  function handleAddGoal() {
    setGoals((prev) => [...prev, createTargetFormEntry()]);
  }

  function handleRemoveGoal(id: string) {
    setGoals((prev) => prev.filter((entry) => entry.id !== id));
  }

  function formatTargetDate(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      return trimmed;
    }
    return previewDateFormatter.format(new Date(trimmed));
  }

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
    let parsedFtp: number | null = null;
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

    if (ftpWatts.trim().length > 0) {
      const value = Number(ftpWatts);
      if (!Number.isFinite(value)) {
        setError('FTP must be a number.');
        setIsSaving(false);
        return;
      }
      if (!Number.isInteger(value)) {
        setError('FTP must be entered as whole watts.');
        setIsSaving(false);
        return;
      }
      if (value < 0 || value > 2000) {
        setError('FTP must be between 0 and 2000 watts.');
        setIsSaving(false);
        return;
      }
      parsedFtp = value;
    }

    let eventPayloads: ProfileTarget[] = [];
    let goalPayloads: ProfileTarget[] = [];

    try {
      eventPayloads = buildTargetPayload(events, 'event');
      goalPayloads = buildTargetPayload(goals, 'goal');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please review your events and goals.';
      setError(message);
      setIsSaving(false);
      return;
    }

    const trimmedStrengths = strengths.trim();
    const trimmedWeaknesses = weaknesses.trim();

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
        ftpWatts: parsedFtp,
        websiteUrl: trimmedWebsiteUrl.length > 0 ? trimmedWebsiteUrl : null,
        instagramHandle: trimmedInstagram.length > 0 ? trimmedInstagram : null,
        achievements: trimmedAchievements.length > 0 ? trimmedAchievements : null,
        events: eventPayloads,
        goals: goalPayloads,
        strengths: trimmedStrengths.length > 0 ? trimmedStrengths : null,
        weaknesses: trimmedWeaknesses.length > 0 ? trimmedWeaknesses : null,
        weightKg,
        hrMaxBpm,
        hrRestBpm,
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
      setFtpWatts(updated.ftpWatts != null ? String(updated.ftpWatts) : '');
      setWebsiteUrl(updated.websiteUrl ?? '');
      setInstagramHandle(updated.instagramHandle ?? '');
      setAchievements(updated.achievements ?? '');
      setEvents(mapTargetsToForm(updated.events));
      setGoals(mapTargetsToForm(updated.goals));
      setStrengths(updated.strengths ?? '');
      setWeaknesses(updated.weaknesses ?? '');
      setPowerBests(mergePowerBests(updated.powerBests));
      setWeightKg(updated.weightKg ?? null);
      setHrMaxBpm(updated.hrMaxBpm ?? null);
      setHrRestBpm(updated.hrRestBpm ?? null);
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

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="ftpWatts">
                      Functional threshold power (watts)
                    </label>
                    <Input
                      id="ftpWatts"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={2000}
                      step={1}
                      value={ftpWatts}
                      onChange={(event) => setFtpWatts(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used as the anchor for durability and intensity analyses.
                    </p>
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
                  <CardTitle className="text-base font-semibold">Key events & goals</CardTitle>
                  <CardDescription>
                    Map out the rides and breakthroughs that define your season-long focus.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Events</h3>
                        <p className="text-xs text-muted-foreground">
                          Capture the timing, distance, and power demands for important rides.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddEvent}
                        disabled={events.length >= 20}
                      >
                        + Add event
                      </Button>
                    </div>
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Use the + button to add races, training camps, or signature adventures you&apos;re targeting.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {events.map((entry, index) => (
                          <div key={entry.id} className="space-y-3 rounded-lg border bg-muted/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">Event {index + 1}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveEvent(entry.id)}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-name-${entry.id}`}>
                                  Name
                                </label>
                                <Input
                                  id={`event-name-${entry.id}`}
                                  value={entry.name}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, name: event.target.value } : item,
                                      ),
                                    )
                                  }
                                  placeholder="e.g. Unbound Gravel 200"
                                  maxLength={200}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-date-${entry.id}`}>
                                  Date
                                </label>
                                <Input
                                  id={`event-date-${entry.id}`}
                                  type="date"
                                  value={entry.date}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, date: event.target.value } : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-duration-${entry.id}`}>
                                  Duration (hours)
                                </label>
                                <Input
                                  id={`event-duration-${entry.id}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={0.25}
                                  value={entry.durationHours}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, durationHours: event.target.value } : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-distance-${entry.id}`}>
                                  Distance (km)
                                </label>
                                <Input
                                  id={`event-distance-${entry.id}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={0.1}
                                  value={entry.distanceKm}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, distanceKm: event.target.value } : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-critical-duration-${entry.id}`}>
                                  Critical effort duration (minutes)
                                </label>
                                <Input
                                  id={`event-critical-duration-${entry.id}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={1}
                                  value={entry.criticalDurationMinutes}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, criticalDurationMinutes: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-critical-power-${entry.id}`}>
                                  Critical effort power (watts)
                                </label>
                                <Input
                                  id={`event-critical-power-${entry.id}`}
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  step={1}
                                  value={entry.criticalPowerWatts}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, criticalPowerWatts: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-target-power-${entry.id}`}>
                                  Target average power (watts)
                                </label>
                                <Input
                                  id={`event-target-power-${entry.id}`}
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  step={1}
                                  value={entry.targetAveragePowerWatts}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, targetAveragePowerWatts: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`event-notes-${entry.id}`}>
                                  Notes
                                </label>
                                <textarea
                                  id={`event-notes-${entry.id}`}
                                  value={entry.notes}
                                  onChange={(event) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, notes: event.target.value } : item,
                                      ),
                                    )
                                  }
                                  rows={3}
                                  maxLength={500}
                                  placeholder="Log travel plans, nutrition strategy, or pacing reminders."
                                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Goals</h3>
                        <p className="text-xs text-muted-foreground">
                          Document milestone efforts so we can measure progress ride by ride.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddGoal}
                        disabled={goals.length >= 20}
                      >
                        + Add goal
                      </Button>
                    </div>
                    {goals.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Outline season objectives like FTP benchmarks, epic endurance rides, or repeatability targets.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {goals.map((entry, index) => (
                          <div key={entry.id} className="space-y-3 rounded-lg border bg-muted/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">Goal {index + 1}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveGoal(entry.id)}
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-name-${entry.id}`}>
                                  Name
                                </label>
                                <Input
                                  id={`goal-name-${entry.id}`}
                                  value={entry.name}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, name: event.target.value } : item,
                                      ),
                                    )
                                  }
                                  placeholder="e.g. 4 hours at 225 W"
                                  maxLength={200}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-date-${entry.id}`}>
                                  Target date
                                </label>
                                <Input
                                  id={`goal-date-${entry.id}`}
                                  type="date"
                                  value={entry.date}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, date: event.target.value } : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-duration-${entry.id}`}>
                                  Duration (hours)
                                </label>
                                <Input
                                  id={`goal-duration-${entry.id}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={0.25}
                                  value={entry.durationHours}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, durationHours: event.target.value } : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-distance-${entry.id}`}>
                                  Distance (km)
                                </label>
                                <Input
                                  id={`goal-distance-${entry.id}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={0.1}
                                  value={entry.distanceKm}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, distanceKm: event.target.value } : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-critical-duration-${entry.id}`}>
                                  Critical effort duration (minutes)
                                </label>
                                <Input
                                  id={`goal-critical-duration-${entry.id}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={1}
                                  value={entry.criticalDurationMinutes}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, criticalDurationMinutes: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-critical-power-${entry.id}`}>
                                  Critical effort power (watts)
                                </label>
                                <Input
                                  id={`goal-critical-power-${entry.id}`}
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  step={1}
                                  value={entry.criticalPowerWatts}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, criticalPowerWatts: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-target-power-${entry.id}`}>
                                  Target average power (watts)
                                </label>
                                <Input
                                  id={`goal-target-power-${entry.id}`}
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  step={1}
                                  value={entry.targetAveragePowerWatts}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, targetAveragePowerWatts: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-medium text-foreground" htmlFor={`goal-notes-${entry.id}`}>
                                  Notes
                                </label>
                                <textarea
                                  id={`goal-notes-${entry.id}`}
                                  value={entry.notes}
                                  onChange={(event) =>
                                    setGoals((prev) =>
                                      prev.map((item) =>
                                        item.id === entry.id ? { ...item, notes: event.target.value } : item,
                                      ),
                                    )
                                  }
                                  rows={3}
                                  maxLength={500}
                                  placeholder="Describe why this goal matters or how you&apos;ll measure success."
                                  className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Strengths & opportunities</CardTitle>
                  <CardDescription>
                    Share where you thrive and where you&apos;re investing effort so coaches can tailor feedback.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="strengths">
                      Self-described strengths
                    </label>
                    <textarea
                      id="strengths"
                      value={strengths}
                      onChange={(event) => setStrengths(event.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder={"Climbing on long gradients\nEndurance after 3 hours"}
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">Use one strength per line to keep things readable.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor="weaknesses">
                      Areas for growth
                    </label>
                    <textarea
                      id="weaknesses"
                      value={weaknesses}
                      onChange={(event) => setWeaknesses(event.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder={"Anaerobic repeatability\nHeat adaptation"}
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">Helps AI insights focus on the skills you&apos;re developing.</p>
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
                        <dt className="font-medium text-foreground">FTP anchor</dt>
                        <dd className="text-muted-foreground">
                          {previewFtpWatts != null
                            ? `${previewFtpWatts} W`
                            : 'Add FTP to power durability insights.'}
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
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Strengths & focus</h4>
                      <div className="mt-2 grid gap-4 text-sm md:grid-cols-2">
                        <div>
                          <p className="font-medium text-foreground">Strengths</p>
                          {parsedStrengths.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                              {parsedStrengths.map((item, index) => (
                                <li key={`strength-${item}-${index}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Share where teammates can count on you.
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Opportunities</p>
                          {parsedWeaknesses.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                              {parsedWeaknesses.map((item, index) => (
                                <li key={`weakness-${item}-${index}`}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Call out skills you&apos;re working to develop.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Upcoming events</h4>
                      {events.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {events.map((entry, index) => {
                            const name = entry.name.trim().length > 0 ? entry.name : `Event ${index + 1}`;
                            const dateLabel = formatTargetDate(entry.date);
                            const summary = formatTargetSummary(entry);
                            const notes = entry.notes.trim();
                            return (
                              <li
                                key={`preview-event-${entry.id}`}
                                className="rounded-lg border border-muted bg-background/60 p-3 text-sm"
                              >
                                <p className="font-semibold text-foreground">{name}</p>
                                {dateLabel ? (
                                  <p className="text-xs text-muted-foreground">{dateLabel}</p>
                                ) : null}
                                {summary.length > 0 ? (
                                  <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
                                ) : null}
                                {notes.length > 0 ? (
                                  <p className="mt-1 text-xs italic text-muted-foreground">{notes}</p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Use the + Add event button to log upcoming rides you&apos;re training for.
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Goals</h4>
                      {goals.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {goals.map((entry, index) => {
                            const name = entry.name.trim().length > 0 ? entry.name : `Goal ${index + 1}`;
                            const dateLabel = formatTargetDate(entry.date);
                            const summary = formatTargetSummary(entry);
                            const notes = entry.notes.trim();
                            return (
                              <li
                                key={`preview-goal-${entry.id}`}
                                className="rounded-lg border border-muted bg-background/60 p-3 text-sm"
                              >
                                <p className="font-semibold text-foreground">{name}</p>
                                {dateLabel ? (
                                  <p className="text-xs text-muted-foreground">Target by {dateLabel}</p>
                                ) : null}
                                {summary.length > 0 ? (
                                  <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
                                ) : null}
                                {notes.length > 0 ? (
                                  <p className="mt-1 text-xs italic text-muted-foreground">{notes}</p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Add goals to see how each activity moves you toward your targets.
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Power bests</h4>
                      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                        {labelledPowerBests.map((entry) => (
                          <div key={`power-best-${entry.durationMinutes}`}>
                            <dt className="text-muted-foreground">{entry.label}</dt>
                            <dd className="font-medium text-foreground">
                              {entry.watts != null
                                ? `${numberFormatters.whole.format(entry.watts)} W`
                                : '—'}
                            </dd>
                          </div>
                        ))}
                      </dl>
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
