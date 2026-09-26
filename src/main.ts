import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Application, Request, Response } from 'express';
import { AppModule } from './app.module';
import { PlotWeaverLogger } from './logger/plot-weaver-logger';

async function bootstrap() {
  const logger = new PlotWeaverLogger([
    'log',
    'warn',
    'error',
    'debug',
    'verbose',
  ]);
  const app = await NestFactory.create(AppModule, { logger });
  app.useLogger(logger);

  // Allowed browser origins -- falls back to FRONTEND_URL, never to '*'
  const allowedOrigins = (
    process.env.CORS_ORIGIN ??
    process.env.FRONTEND_URL ??
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
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

  SwaggerModule.setup('/docs', app, openApiDoc);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(console.error);
