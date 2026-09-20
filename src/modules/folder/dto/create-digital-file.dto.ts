import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDigitalFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  readonly name!: string;

  @IsString()
  @MaxLength(500)
  readonly description!: string;
}
