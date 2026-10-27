import { IsString } from 'class-validator';

export class CreateStageDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly description!: string;
}
