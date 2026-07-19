import { Module } from '@nestjs/common';
import { PlatformAuthController } from '../../controllers';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlatformAuthController],
})
export class PlatformAuthModule {}
