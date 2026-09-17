import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
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
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() createFolderDto: CreateFolderDto,
  ) {
    return this.folderService.createFolder(userId, createFolderDto, stageId);
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getFolder(@Param('id', ParseUUIDPipe) id: string) {
    return this.folderService.getFolder(id);
  }
}
