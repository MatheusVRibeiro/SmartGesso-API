import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import {
  ATTACHMENT_ALLOWED_MIME_TYPES,
  AttachmentsService,
} from './attachments.service';
import { CreateAttachmentDto } from './dto';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * POST /attachments — upload de arquivo privado.
   * Multipart: campo `file` + `entityType` + `entityId` no body.
   */
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
      fileFilter: (_req, file, cb) => {
        if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Tipo de arquivo não permitido: ${file.mimetype}.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Req() r: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado (campo `file`)');
    }
    return this.attachmentsService.create(
      r.company.id,
      r.user.id,
      file,
      dto.entityType,
      dto.entityId,
    );
  }

  /**
   * GET /attachments?entityType=&entityId= — lista anexos de uma entidade.
   */
  @Get()
  findAll(
    @Req() r: any,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    if (!entityType || !entityId) {
      throw new BadRequestException(
        'Query params `entityType` e `entityId` são obrigatórios',
      );
    }
    return this.attachmentsService.listByEntity(
      r.company.id,
      entityType,
      entityId,
    );
  }

  /**
   * GET /attachments/:id/download — download autorizado via res.sendFile.
   * NUNCA servido estaticamente (fora do prefixo /uploads).
   */
  @Get(':id/download')
  async download(
    @Req() r: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentsService.findOne(
      r.company.id,
      id,
    );

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.originalName}"`,
    );
    res.sendFile(attachment.storagePath, (err) => {
      if (err) {
        res.status(404).json({
          statusCode: 404,
          message: 'Arquivo não encontrado no disco',
        });
      }
    });
  }

  /** DELETE /attachments/:id — soft delete. */
  @Delete(':id')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.attachmentsService.remove(r.company.id, id);
  }
}
