import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { randomUUID } from 'node:crypto';

describe('SmartGesso e2e multiempresa (Prisma)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ADMIN_EMAIL = process.env.SEED_PLATFORM_ADMIN_EMAIL || 'admin@smartgesso.local';
  const ADMIN_PASSWORD = 'SmartGesso@2026';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAdmin() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return res.body.accessToken;
  }

  async function setupOwner(email: string, prefix: string) {
    const token = await loginAdmin();
    const auth = { Authorization: `Bearer ${token}` };
    const uid = randomUUID().slice(0, 8);

    const plan = await request(app.getHttpServer())
      .post('/api/v1/platform/plans')
      .set(auth)
      .send({ name: `Plano ${prefix}`, code: `${prefix}-${uid}`, defaultPrice: '100.00', maxUsers: 3, maxStorageMb: 100 })
      .expect(201);

    const c = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set(auth)
      .send({ legalName: prefix, tradeName: prefix, document: `${prefix}-${uid}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${c.body.id}/subscriptions`)
      .set(auth)
      .send({ planId: plan.body.id, startDate: '2026-01-01', endDate: '2027-01-01', agreedPrice: '100.00' })
      .expect(201);

    const inv = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${c.body.id}/owner-invitations`)
      .set(auth)
      .send({ name: prefix, email })
      .expect(201);

    const acc = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({ token: inv.body.token, password: 'Senha@123456' })
      .expect(201);

    return { company: c.body, token: acc.body.accessToken };
  }

  it('blocks mobile user from platform routes and from unlinked company switch', async () => {
    const a = await setupOwner('a.mult@example.com', 'EmpresaA');
    const b = await setupOwner('b.mult@example.com', 'EmpresaB');

    await request(app.getHttpServer())
      .get('/api/v1/platform/companies')
      .set({ Authorization: `Bearer ${a.token}` })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/auth/switch-company')
      .set({ Authorization: `Bearer ${a.token}` })
      .send({ companyId: b.company.id })
      .expect(401);
  });

  it('suspended company can see access status but cannot operate', async () => {
    const adminToken = await loginAdmin();
    const auth = { Authorization: `Bearer ${adminToken}` };

    const a = await setupOwner('a.susp@example.com', 'EmpresaSusp');

    await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${a.company.id}/suspend`)
      .set(auth)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/company/access-status')
      .set({ Authorization: `Bearer ${a.token}` })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/company/profile')
      .set({ Authorization: `Bearer ${a.token}` })
      .expect(402);
  });
});
