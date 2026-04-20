import { IsEmail, IsIP, IsString, IsUUID, MinLength } from 'class-validator';

export class LoginUserDto {
  @IsEmail()
  readonly email!: string;

  @IsString()
  @MinLength(8)
  readonly password!: string;

  @IsUUID('4')
  readonly deviceId!: string;

  @IsString()
  @MinLength(3)
  readonly deviceInfo!: string;

  @IsIP()
  readonly ipAddress!: string;
}
