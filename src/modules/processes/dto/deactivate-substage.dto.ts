import { IsString } from 'class-validator';

export class DeactivateSubstageDto {
  @IsString()
  readonly reason!: string;
}
