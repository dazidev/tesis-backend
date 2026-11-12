import { Transform } from 'class-transformer';
import { IsIn, IsString, MinLength, MaxLength } from 'class-validator';
import { DeactivateType } from '../interfaces';

export class UserDeactivateDto {
  @IsString()
  @IsIn(['inactive', 'suspended'])
  readonly type!: DeactivateType;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(10)
  @MaxLength(250)
  readonly reason!: string;
}
