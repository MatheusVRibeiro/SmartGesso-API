import { Module } from '@nestjs/common';
import { PlatformAuthController } from './platform-auth.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlatformAuthController],
})
export class PlatformAuthModule {}
