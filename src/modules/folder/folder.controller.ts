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
  Delete,
  Header,
  StreamableFile,
  Patch,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { FolderService } from './folder.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { User, ValidRoles } from '../auth/interfaces';
import { GetUser } from '../auth/decorators';
import {
  CreateDigitalFileDto,
  CreateFolderDto,
  UpdateDigitalFileDto,
} from './dto';

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

  @Get('file/:fileId/view')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('X-Content-Type-Options', 'nosniff')
  async viewFile(
    @GetUser() user: User,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<StreamableFile> {
    const file = await this.folderService.viewFile(user, fileId);

    const safeFilename = file.name
      .replace(/["\r\n]/g, '_')
      .replace(/\.pdf$/i, '');

    const encodedFilename = encodeURIComponent(`${safeFilename}.pdf`);

    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${safeFilename}.pdf"; filename*=UTF-8''${encodedFilename}`,
      length: file.size,
    });
  }

  /* @Get('file/:fileId/download')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadFile(
    @GetUser() user: User,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<StreamableFile> {
    const file = await this.folderService.downloadFile(user, fileId);

    const safeFilename = file.originalName.replace(/["\r\n]/g, '_');

    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `attachment; filename="${safeFilename}"`,
      length: file.size,
    });
  }*/

  @Patch('file/:fileId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  updateFile(
    @GetUser() user: User,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() updateDigitalFileDto: UpdateDigitalFileDto,
  ) {
    return this.folderService.updateFile(user, fileId, updateDigitalFileDto);
  }

  @Delete('file/:fileId')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  deleteFile(
    @GetUser('id') userId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.folderService.deleteFile(userId, fileId);
  }
}
