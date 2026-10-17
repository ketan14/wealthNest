import { Result } from '@wealthnest/shared';
import { UserId, UserProfile } from '@wealthnest/domain';

export interface AuthSession {
  readonly userId: UserId;
  readonly accessToken: string;
  readonly expiresAt: number;
}

export interface AuthPort {
  getCurrentSession(): Promise<Result<AuthSession | null>>;
  getCurrentUser(): Promise<Result<UserProfile | null>>;
}
