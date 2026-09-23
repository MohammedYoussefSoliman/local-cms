import { User } from '@cms/database';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * `forwardRef` on both sides of a genuine mutual dependency: `AuthModule` needs
 * `UsersService` to load an account on every request, and `UsersService` needs
 * `AuthService` to revoke that account's sessions when it is disabled or its
 * password changes. The alternative — a second copy of the revoke-all query in
 * this service — would be two implementations of the rule that disabling locks
 * someone out, which is exactly the kind of pair that drifts.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
