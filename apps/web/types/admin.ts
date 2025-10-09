export type UserRole = 'ADMIN' | 'USER';

export interface AdminUserSummary {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserListResponse {
  data: AdminUserSummary[];
  page: number;
  pageSize: number;
  total: number;
}
