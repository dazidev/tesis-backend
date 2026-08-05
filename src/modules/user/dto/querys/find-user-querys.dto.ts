import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from 'src/generated/prisma/client';

export class FindUserQuerysDto {
  @IsOptional()
  @IsEnum(UserRole)
  readonly role!: UserRole;
}
