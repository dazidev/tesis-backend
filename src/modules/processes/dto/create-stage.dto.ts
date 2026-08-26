import { IsNumber, IsString } from 'class-validator';

export class CreateStageDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly description!: string;

  @IsNumber()
  readonly order!: number;
}
