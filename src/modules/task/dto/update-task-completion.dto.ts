import { IsBoolean } from 'class-validator';

export class UpdateTaskCompletionDto {
  @IsBoolean()
  readonly completed!: boolean;
}
