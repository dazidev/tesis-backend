import { IsEmail, IsEnum, IsUUID } from 'class-validator';
import { ValidRoles } from 'src/modules/auth/interfaces';

export class UserInivitationDto {
  @IsEmail()
  readonly toEmail!: string;

  @IsEnum(ValidRoles)
  readonly role!: ValidRoles;

  @IsUUID()
  readonly createdById!: string;
}
