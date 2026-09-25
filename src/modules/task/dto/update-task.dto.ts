import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly description!: string;

  @IsDateString()
  readonly dueDate!: string;
}
