import { User } from './user';

export interface JwtAccessPayload {
  id: string;
}

export interface JwtRefreshPayload {
  userId: string;
  sessionId: string;
}
