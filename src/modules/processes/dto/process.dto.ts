import { Type } from 'class-transformer';
import { IsEnum, IsString, IsUUID, ValidateNested } from 'class-validator';
import { DefendantDto } from './defendant.dto';
import { ProcessType } from '../interfaces';

export class ProcessDto {
  @IsString()
  readonly courtNumber!: string;

  @IsString()
  readonly caseFileNumber!: string;

  @IsString()
  @IsEnum(ProcessType)
  readonly type!: ProcessType;

  @IsUUID()
  readonly managedByID!: string;

  @ValidateNested()
  @Type(() => DefendantDto)
  readonly defendant!: DefendantDto;
}
