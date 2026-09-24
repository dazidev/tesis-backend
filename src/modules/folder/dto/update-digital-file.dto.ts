import { IsString, MaxLength, MinLength } from 'class-validator';

//! todo: review the characters limits
export class UpdateDigitalFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  readonly name!: string;

  @IsString()
  @MaxLength(500)
  readonly description!: string;
}
