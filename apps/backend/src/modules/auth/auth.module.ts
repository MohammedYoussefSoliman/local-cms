import { RefreshSession } from '@cms/database';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    // Secrets are passed per-sign call in AuthService so the access and
    // refresh paths cannot accidentally share one.
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshSession]),
    // Mutual: `UsersService` needs `AuthService.revokeAllForUser` to make
    // disabling an account take effect immediately. See `UsersModule`.
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
