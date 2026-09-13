import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageProvider } from './storage-provider';

@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    { provide: 'StorageProvider', useClass: LocalStorageProvider },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
