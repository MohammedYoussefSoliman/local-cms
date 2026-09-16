import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { type Env, validateEnv } from './config/env.validation';
import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        typeOrmConfig({
          DATABASE_HOST: config.getOrThrow('DATABASE_HOST'),
          DATABASE_PORT: config.getOrThrow('DATABASE_PORT'),
          DATABASE_USER: config.getOrThrow('DATABASE_USER'),
          DATABASE_PASSWORD: config.getOrThrow('DATABASE_PASSWORD'),
          DATABASE_NAME: config.getOrThrow('DATABASE_NAME'),
          DATABASE_LOGGING: config.get('DATABASE_LOGGING') ?? false,
        } as Env),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    AuthModule,
    HealthModule,
    UsersModule,
  ],
  providers: [
    /**
     * Order matters. Nest runs global guards in registration order, so
     * authentication resolves before roles are checked — a `@Roles()` guard
     * reading `request.user` before the JWT guard has populated it would
     * reject every request.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
