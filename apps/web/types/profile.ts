export interface Profile {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  primaryDiscipline: string | null;
  trainingFocus: string | null;
  weeklyGoalHours: number | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  achievements: string | null;
  createdAt: string;
  updatedAt: string;
}
