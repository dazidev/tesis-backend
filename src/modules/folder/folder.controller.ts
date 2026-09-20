import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { FolderService } from './folder.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import { CreateDigitalFileDto, CreateFolderDto } from './dto';

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

  @Post(':folderId/file')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadFile(
    @GetUser('id')
    userId: string,

    @Param('folderId', ParseUUIDPipe)
    folderId: string,

    @Body()
    createDigitalFileDto: CreateDigitalFileDto,

    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'application/pdf',
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024,
        })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.folderService.uploadFile(
      userId,
      folderId,
      createDigitalFileDto,
      file,
    );
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  getFolder(@Param('id', ParseUUIDPipe) id: string) {
    return this.folderService.getFolder(id);
  }
}
