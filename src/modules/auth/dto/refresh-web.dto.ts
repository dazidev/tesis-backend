import { IsString, IsUUID } from 'class-validator';

export class RefreshWebDto {
  @IsString()
  readonly refreshToken!: string;
}
