import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly description!: string;

  @IsOptional()
  @IsUUID()
  readonly substageId?: string;
}
