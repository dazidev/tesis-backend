import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeactivateFolderDto {
  @IsString()
  @MinLength(10)
  @MaxLength(250)
  readonly reason!: string;
}
