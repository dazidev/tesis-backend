export interface CreateLog {
  userId?: string;
  affected?: string;
  entity?: string;
  action: string;
  description: string;
}
