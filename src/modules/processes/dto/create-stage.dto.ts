import { IsInt, IsString, Min } from 'class-validator';

export class CreateStageDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly description!: string;

  @IsInt()
  @Min(1)
  readonly order!: number;
}
