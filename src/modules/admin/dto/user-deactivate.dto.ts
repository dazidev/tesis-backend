import { IsIn, IsString } from 'class-validator';
import { DeactivateType } from '../interfaces';

export class UserDeactivateDto {
  @IsString()
  @IsIn(['inactive', 'suspended'])
  readonly type!: DeactivateType;

  @IsString()
  readonly reason!: string;
}
