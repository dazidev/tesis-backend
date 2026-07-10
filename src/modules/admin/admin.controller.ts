import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces';
import { UserDeactivateDto, UserInivitationDto } from './dto';
import { GetUser } from '../auth/decorators';

@Auth(ValidRoles.admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('user-invitation')
  sendUserInvitation(
    @GetUser('id') userId: string,
    @Body() userInivitationDto: UserInivitationDto,
  ) {
    return this.adminService.sendUserInvitation(userInivitationDto, userId);
  }

  @Patch('users/:id/deactivate')
  userDeactivate(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() userDeactivateDto: UserDeactivateDto,
  ) {
    return this.adminService.userDeactivate(id, userDeactivateDto, userId);
  }
}
