import type { Prisma, Profile } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { resolveFtpWatts } from '../src/services/durableTssService.js';

function createProfile(overrides: Partial<Profile> = {}): Profile {
  const base: Profile = {
    id: 'profile-1',
    userId: 'user-1',
    displayName: null,
    avatarUrl: null,
    bio: null,
    location: null,
    primaryDiscipline: null,
    trainingFocus: null,
    weeklyGoalHours: null,
    ftpWatts: null,
    weightKg: null,
    hrMaxBpm: null,
    hrRestBpm: null,
    websiteUrl: null,
    instagramHandle: null,
    achievements: null,
    analytics: {} as Prisma.JsonObject,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...base, ...overrides };
}

describe('resolveFtpWatts', () => {
  it('returns the explicit FTP value when present', () => {
    const profile = createProfile({ ftpWatts: 255 });
    expect(resolveFtpWatts(profile)).toBe(255);
  });

  it('falls back to the adaptation FTP estimate when FTP is missing', () => {
    const profile = createProfile({
      ftpWatts: null,
      analytics: {
        adaptationEdges: {
          ftpEstimate: 247.3,
        },
      } as Prisma.JsonObject,
    });

    expect(resolveFtpWatts(profile)).toBeCloseTo(247.3, 5);
  });

  it('returns null when neither explicit FTP nor an estimate are available', () => {
    const profile = createProfile({ ftpWatts: null, analytics: {} as Prisma.JsonObject });
    expect(resolveFtpWatts(profile)).toBeNull();
  });

  it('ignores non-numeric FTP estimates', () => {
    const profile = createProfile({
      ftpWatts: null,
      analytics: {
        adaptationEdges: {
          ftpEstimate: 'not-a-number',
        },
      } as Prisma.JsonObject,
    });

    expect(resolveFtpWatts(profile)).toBeNull();
  });
});
