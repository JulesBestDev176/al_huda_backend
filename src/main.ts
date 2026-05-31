import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { Connection } from 'mongoose';
import * as dns from 'dns';
import * as net from 'net';
import { AppModule } from './app.module';

// Forcer l'utilisation de Google DNS (résoud le problème api-inference.huggingface.co)
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

function serviceState(ok: boolean) {
  return ok ? '🟢 connecté' : '🟡 non vérifié';
}

async function checkHttp(url?: string): Promise<boolean> {
  if (!url) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkTcp(url?: string): Promise<boolean> {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = Number(parsed.port);
    if (!host || !port) return false;

    return await new Promise((resolve) => {
      const socket = net.createConnection({ host, port, timeout: 2500 });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => resolve(false));
    });
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // CORS (pour le frontend Next.js)
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
  ];
  const allowedOrigins = [
    ...devOrigins,
    process.env.FRONTEND_URL,
    'https://al-huda-two.vercel.app',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origine non autorisée — ${origin}`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Préfixe global API
  app.setGlobalPrefix('api');

  // Swagger (documentation interactive)
  const config = new DocumentBuilder()
    .setTitle('Hadith Sénégal API')
    .setDescription('API de recherche de hadiths authentiques en français et arabe')
    .setVersion('1.0')
    .addTag('hadiths')
    .addTag('search')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<string>('PORT') || 4000;
  await app.listen(port);

  const qdrantUrl = configService.get<string>('QDRANT_URL');
  const redisUrl = configService.get<string>('REDIS_URL');
  const embeddingModel = configService.get<string>('EMBEDDING_MODEL');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const mongoConnection = app.get<Connection>(getConnectionToken());

  const [qdrantOk, redisOk] = await Promise.all([
    checkHttp(qdrantUrl ? `${qdrantUrl.replace(/\/$/, '')}/collections` : undefined),
    checkTcp(redisUrl),
  ]);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🕌 Hadith Sénégal Backend');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 API REST        : http://localhost:${port}/api`);
  console.log(`📖 Swagger Docs    : http://localhost:${port}/api/docs`);
  console.log(`🍃 MongoDB         : ${serviceState(mongoConnection.readyState === 1)} (${mongoConnection.name || 'hadith_db'})`);
  console.log(`🔎 Qdrant          : ${serviceState(qdrantOk)} (${qdrantUrl || 'non configuré'})`);
  console.log(`🧰 Redis           : ${serviceState(redisOk)} (${redisUrl || 'non configuré'})`);
  console.log(`🧠 Embeddings      : ${embeddingModel || 'non configuré'}`);
  console.log(`🌐 Frontend CORS   : ${frontendUrl || 'localhost/127.0.0.1 ports 3000-3003'}`);
  console.log('🔥 Watch mode      : npm run dev recharge à chaque modification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

bootstrap();
