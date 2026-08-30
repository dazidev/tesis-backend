import { IsString } from 'class-validator';

export class DeactivateStageDto {
  @IsString()
  readonly reason!: string;
}
