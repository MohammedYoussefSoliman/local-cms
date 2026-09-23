import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser, Roles } from '@/common';

import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Declared before `:id/...` so `me` is read as a literal. Express would match
   * either way here — the last segments differ — but relying on that is how the
   * next route added below quietly starts shadowing this one.
   *
   * no-role: everyone changes their own password, and an editor has exactly as
   * much right to as an admin. The scope check is the `sub` claim, not a role:
   * the route cannot address anyone else's account.
   *
   * Throttled because this is the third endpoint in the API where guessing a
   * password is the attack — `argon2.verify` runs against `currentPassword`.
   * Looser than login's 5/min: an attacker here already holds a valid access
   * token for the account they are guessing at, so this is hardening a narrow
   * path rather than guarding the front door.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    await this.users.changePassword(userId, dto);
  }

  /**
   * Admin throughout the rest of this controller. The user list is the map of
   * who can change published copy, which makes reading it a privileged act in
   * its own right, not just a precursor to writing.
   */
  @Roles('admin')
  @Get()
  findAll(@Query() query: ListUsersQueryDto) {
    return this.users.findAll(query);
  }

  @Roles('admin')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  /** Creates an `invited` account — see `UsersService.create`. */
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto);
  }

  /**
   * A status change rather than a `DELETE`: `translation_value_versions.
   * changed_by` and `api_keys.created_by` point at this row, and an audit trail
   * that forgets who made the change is not an audit trail.
   *
   * Takes the caller's id so the service can refuse a self-disable.
   */
  @Roles('admin')
  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actingUserId: string,
  ) {
    return this.users.disable(id, actingUserId);
  }

  @Roles('admin')
  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  enable(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.enable(id);
  }
}
