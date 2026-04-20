type UserRoles = 'admin' | 'lawyer' | 'client';
type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  name: string;
  lastname: string;
  email: string;
  password?: string;
  invitationCode?: string | null;
  roles: UserRoles[];
  status: UserStatus;
  lawyerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  sessionId?: string;
}
