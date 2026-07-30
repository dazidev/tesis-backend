import { IsDateString, IsString } from 'class-validator';

export class DefendantDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly lastname!: string;

  @IsDateString()
  readonly birthDate!: string;

  @IsDateString()
  readonly deathDate!: string;
}
