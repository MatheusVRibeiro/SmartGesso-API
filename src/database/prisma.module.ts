import { Global, Module } from '@nestjs/common';
import { PrismaRepositoryService } from './prisma-repository.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, PrismaRepositoryService],
  exports: [PrismaService, PrismaRepositoryService],
})
export class PrismaModule {}
