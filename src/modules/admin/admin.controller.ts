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
import { type User, ValidRoles } from '../auth/interfaces';
import { UserDeactivateDto, UserInivitationDto, UserUpdateDto } from './dto';
import { GetUser } from '../auth/decorators';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('user-invitation')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  sendUserInvitation(
    @GetUser() user: User,
    @Body() userInvitationDto: UserInivitationDto,
  ) {
    return this.adminService.sendUserInvitation(userInvitationDto, user);
  }

  @Patch('users/:id/deactivate')
  @Auth(ValidRoles.admin)
  userDeactivate(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() userDeactivateDto: UserDeactivateDto,
  ) {
    return this.adminService.userDeactivate(id, userDeactivateDto, userId);
  }

  @Patch('users/:id')
  @Auth(ValidRoles.admin)
  updateUser(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() userUpdateDto: UserUpdateDto,
  ) {
    return this.adminService.updateUser(id, userUpdateDto, userId);
  }

  @Patch('user-invitations/:invitationId/cancel')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  cancelUserInvitation(
    @GetUser() user: User,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.adminService.cancelUserInvitation(invitationId, user);
  }

  @Post('user-invitations/:invitationId/resend')
  @Auth(ValidRoles.admin, ValidRoles.lawyer)
  resendUserInvitation(
    @GetUser() user: User,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.adminService.resendUserInvitation(invitationId, user);
  }
}
