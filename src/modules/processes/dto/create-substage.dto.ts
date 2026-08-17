import { IsOptional, IsString } from 'class-validator';

export class CreateSubstageDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly description!: string;

  @IsOptional()
  @IsString()
  readonly parentSubstageId!: string;
}
