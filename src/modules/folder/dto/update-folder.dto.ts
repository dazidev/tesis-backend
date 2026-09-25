import { IsString } from 'class-validator';

//! todo: review the characters limits
export class UpdateFolderDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly description!: string;
}
