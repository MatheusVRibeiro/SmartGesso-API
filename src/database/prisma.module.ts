import { Global, Module } from '@nestjs/common';
import { PrismaRepositoryService } from './prisma-repository.service';
import { PrismaService } from './prisma.service';
import { MemoryStore } from './memory.store';

@Global()
@Module({
  providers: [PrismaService, PrismaRepositoryService, MemoryStore],
  exports: [PrismaService, PrismaRepositoryService, MemoryStore],
})
export class PrismaModule {}
