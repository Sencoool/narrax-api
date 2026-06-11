import { apiReference } from '@scalar/nestjs-api-reference';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Application, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS สำหรับ frontend
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Plot-weaver API')
    .setDescription('Backend API สำหรับเว็บแต่งนิยายด้วย AI')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const openApiDoc = cleanupOpenApiDoc(document);

  const httpAdapter = app.getHttpAdapter().getInstance() as Application;
  httpAdapter.get('/docs-json', (_req: Request, res: Response) =>
    res.json(openApiDoc),
  );
  httpAdapter.use(
    '/docs',
    apiReference({
      url: '/docs-json',
      title: 'Plot-weaver API',
      layout: 'modern',
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(console.error);
