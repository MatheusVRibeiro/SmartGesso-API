import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { AppModule } from '../src/app.module';
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('SmartGesso API').setVersion('0.1.0').addBearerAuth().build(),
  );
  writeFileSync('openapi.json', JSON.stringify(doc, null, 2));
  await app.close();
}
void main();
