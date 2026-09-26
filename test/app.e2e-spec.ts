import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// The app is deliberately fail-fast about secrets -- JwtStrategy throws at
// construction when JWT_SECRET is missing -- and CI has no .env file. Supply the
// minimum here so this suite does not depend on a developer's local .env.
process.env.JWT_SECRET ??= 'e2e-only-secret';
process.env.MODEL_ENCRYPTION_KEY ??= 'e2e-only-32-character-encryption-key';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        // Mock the health-check query so no real DB is needed in CI
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) returns ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', db: 'ok' });
  });

  afterEach(async () => {
    await app.close();
  });
});
