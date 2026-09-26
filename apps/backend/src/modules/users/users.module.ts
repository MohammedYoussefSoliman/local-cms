import { User, UserInvitation } from '@cms/database';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InviteTokenGuard } from '@/common';

import { AuthModule } from '../auth/auth.module';

import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * `forwardRef` on both sides of a genuine mutual dependency: `AuthModule` needs
 * `UsersService` to load an account on every request, and `UsersService` needs
 * `AuthService` to revoke that account's sessions when it is disabled or its
 * password changes. The alternative — a second copy of the revoke-all query in
 * this service — would be two implementations of the rule that disabling locks
 * someone out, which is exactly the kind of pair that drifts.
 *
 * It also provides and exports `InviteTokenGuard`, for the same reason
 * `ApiKeysModule` exports `ApiKeyGuard`: the guard is not global — `JwtAuthGuard`
 * delegates to it — but `JwtAuthGuard` is constructed by `AppModule`, so the
 * guard has to be resolvable from there.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserInvitation]),
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController, InvitationsController],
  providers: [UsersService, InvitationsService, InviteTokenGuard],
  exports: [UsersService, InvitationsService, InviteTokenGuard],
})
export class UsersModule {}
