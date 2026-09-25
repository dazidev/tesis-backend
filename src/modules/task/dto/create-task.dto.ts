import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly description!: string;

  @IsDateString()
  readonly dueDate!: string;

  @IsOptional()
  @IsUUID()
  readonly substageId?: string;
}
