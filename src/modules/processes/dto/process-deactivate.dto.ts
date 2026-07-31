import { IsString } from 'class-validator';

export class ProcessDeactivateDto {
  @IsString()
  readonly reason!: string;
}
