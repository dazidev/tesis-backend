export const AuthStrategy = {
  ACCESS: 'access-token',
  REFRESH: 'refresh-token',
} as const;

export type AuthStrategyType = (typeof AuthStrategy)[keyof typeof AuthStrategy];
