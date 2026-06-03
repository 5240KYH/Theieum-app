export type UserRole = 'ADMIN' | 'APPROVER' | 'APPLICANT' | string;

export interface AuthenticatedUser {
  id: number;
  loginId: string;
  name: string;
  roles: UserRole[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
