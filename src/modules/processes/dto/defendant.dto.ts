import { IsDate, IsString } from 'class-validator';

export class DefendantDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly lastname!: string;

  @IsDate()
  readonly birthDate!: Date;

  @IsDate()
  readonly deathDate!: Date;
}
