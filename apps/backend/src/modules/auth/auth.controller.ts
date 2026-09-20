import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type {
  AuthTokens,
  CurrentUserResponseData,
  LoginResponseData,
} from '@cms/contracts';
import type { AccessTokenClaims } from '@cms/domain';

import { CurrentUser, Public } from '@/common';

import { UsersService } from '../users/users.service';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /** Rate-limited hard: this is the one endpoint worth brute-forcing. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<LoginResponseData> {
    const { user, ...tokens } = await this.auth.login(
      dto.email,
      dto.password,
      request.headers['user-agent'],
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }

  /**
   * Public to the JWT guard — the access token is expected to be expired here.
   * The refresh token itself is the credential.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
  ): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, request.headers['user-agent']);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  async me(
    @CurrentUser() claims: AccessTokenClaims,
  ): Promise<CurrentUserResponseData> {
    const user = await this.users.findById(claims.sub);
    if (!user) throw new NotFoundException('User not found.');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      // Role-derived for now; becomes a real permission set when the
      // reviewer/translator roles land (arch doc §5).
      permissions: user.role === 'admin' ? ['*'] : ['translations:write'],
    };
  }
}
