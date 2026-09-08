import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import {
  ALLOWED_MIME_TYPES,
  UploadsService,
} from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * POST /uploads — multipart com `file` + contexto (entityType/entityId).
   * Autenticado + empresa ativa (mesma pilha de guards do Mobile).
   */
  @Post()
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Tipo de arquivo não permitido: ${file.mimetype}. Permitidos: jpg, png, webp, gif.`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Req() r: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { error: 'Arquivo não enviado (campo `file`)' };
    }
    // companyId vem SEMPRE da empresa autenticada (nunca do body).
    return this.uploadsService.save(
      r.company.id,
      r.user.id,
      file,
      r.body?.entityType,
      r.body?.entityId,
    );
  }

  /**
   * GET /uploads/:subdir/:filename — download autenticado e autorizado.
   *
   * Substitui o antigo `useStaticAssets` (leitura pública — P1.12): exige JWT
   * (401 sem token), resolve o Attachment pela storageKey e só serve o arquivo
   * se ele pertencer à empresa do token (404 caso contrário — não revela
   * existência para outra empresa). Registros legados (pré-migração, sem
   * registro Attachment) são NEGADOS com 404 (fail-closed): sem registro não é
   * possível validar a empresa dona.
   */
  @Get(':subdir/:filename')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ActiveCompanyGuard)
  async serve(
    @Req() r: any,
    @Param('subdir') subdir: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const resolved = await this.uploadsService.resolveAuthorized(
      r.company.id,
      subdir,
      filename,
    );
    if (!resolved) {
      throw new NotFoundException('Arquivo não encontrado');
    }
    res.setHeader('Content-Type', resolved.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'",
    );
    res.sendFile(resolved.fullPath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({
          statusCode: 404,
          message: 'Arquivo não encontrado no disco',
        });
      }
    });
  }
}
