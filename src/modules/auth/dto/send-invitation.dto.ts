import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from 'src/generated/prisma/enums';

export class SendInvitationDto {
  @IsEmail()
  readonly toEmail!: string;

  @IsEnum(UserRole)
  readonly role!: UserRole;
}
