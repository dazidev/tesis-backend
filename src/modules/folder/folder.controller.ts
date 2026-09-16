import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { FolderService } from './folder.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { CreateFolderDto } from './dto';

@Auth()
@Controller('folder')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post(':stageId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  createFolder(
    @GetUser('id') userId: string,
    @Body() createFolderDto: CreateFolderDto,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.folderService.createFolder(userId, createFolderDto, stageId);
  }
}
