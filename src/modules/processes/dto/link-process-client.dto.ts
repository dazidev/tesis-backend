import { IsEmail } from 'class-validator';

export class LinkProcessClientDto {
  @IsEmail()
  readonly email!: string;
}
