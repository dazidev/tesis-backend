import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeactivateTaskDto {
  @IsString()
  @MinLength(10)
  @MaxLength(250)
  readonly reason!: string;
}
