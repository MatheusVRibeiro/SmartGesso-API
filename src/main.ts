import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { UPLOADS_DIR, UPLOADS_PREFIX } from './modules/uploads/uploads.service';

export async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  // Serve arquivos enviados (fotos) estaticamente em /uploads.
  app.useStaticAssets(UPLOADS_DIR, { prefix: UPLOADS_PREFIX });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const prefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(prefix);
  const config = new DocumentBuilder()
    .setTitle('SmartGesso API')
    .setDescription('API SaaS multiempresa para SmartGesso Mobile e Admin Web')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`🚀 API rodando em: http://localhost:${port}/${prefix}`);
  logger.log(`📚 Swagger Docs em: http://localhost:${port}/docs`);
}
if (require.main === module) void bootstrap();
