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
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS com allowlist de origens (fail-closed: sem env vars, só localhost de dev).
  const corsOrigins = [
    ...(process.env.CORS_MOBILE_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ...(process.env.CORS_ADMIN_WEB_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev && corsOrigins.length === 0) {
    corsOrigins.push(
      'http://localhost:3000',
      'http://localhost:8081',
      'http://127.0.0.1:8081',
      'http://localhost:5173',
    );
  }
  // `*` no .env = refletir qualquer origem (dev). Com allowlist real, valida a origem.
  const allowAllOrigins = corsOrigins.includes('*');
  app.enableCors({
    origin: allowAllOrigins ? true : corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  // Serve arquivos enviados (fotos) estaticamente em /uploads.
  app.useStaticAssets(UPLOADS_DIR, {
    prefix: UPLOADS_PREFIX,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const prefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(prefix);

  // Swagger via env SWAGGER_ENABLED (default: true em dev, false em prod)
  const swaggerEnabled = process.env.SWAGGER_ENABLED !== undefined
    ? process.env.SWAGGER_ENABLED === 'true'
    : isDev;
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('SmartGesso API')
      .setDescription('API SaaS multiempresa para SmartGesso Mobile e Admin Web')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`🚀 API rodando em: http://localhost:${port}/${prefix}`);
  if (swaggerEnabled) {
    logger.log(`📚 Swagger Docs em: http://localhost:${port}/docs`);
  }
}
if (require.main === module) void bootstrap();
