import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { randomUUID } from 'node:crypto';

describe('SmartGesso API (Prisma)', () => {
  let app: INestApplication;

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

  it('admin login with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.admin.email).toBe(ADMIN_EMAIL);
  });

  it('admin login with invalid password returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong password 123' })
      .expect(401);
  });

  it('admin can create company, plan, subscription, installments, payment, invitation and owner accesses', async () => {
    const uid = randomUUID().slice(0, 8);

    const admin = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(201);
    const auth = { Authorization: `Bearer ${admin.body.accessToken}` };

    // Create plan with unique code
    const plan = await request(app.getHttpServer())
      .post('/api/v1/platform/plans')
      .set(auth)
      .send({
        name: 'Profissional',
        code: `PRO-${uid}`,
        defaultPrice: '200.00',
        maxUsers: 5,
        maxStorageMb: 2048,
      })
      .expect(201);

    // Create company with unique document
    const company = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set(auth)
      .send({ legalName: `Gesseiro ${uid}`, tradeName: `Gesseiro ${uid}`, document: `doc-${uid}` })
      .expect(201);

    // Create subscription
    const sub = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${company.body.id}/subscriptions`)
      .set(auth)
      .send({
        planId: plan.body.id,
        startDate: '2026-08-01',
        endDate: '2027-01-31',
        agreedPrice: '1200.00',
        billingType: 'SEMIANNUAL',
      })
      .expect(201);

    // Generate installments
    const installments = await request(app.getHttpServer())
      .post(`/api/v1/platform/subscriptions/${sub.body.id}/installments/generate`)
      .set(auth)
      .send({ count: 6, amount: '1200.00', firstDueDate: '2026-08-10' })
      .expect(201);

    // Partial payment
    await request(app.getHttpServer())
      .post(`/api/v1/platform/subscription-installments/${installments.body[0].id}/payments`)
      .set(auth)
      .send({ amount: '200.00', paymentMethod: 'PIX' })
      .expect(201);

    // Invite owner
    const inv = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${company.body.id}/owner-invitations`)
      .set(auth)
      .send({ name: 'Lucas', email: `lucas-${uid}@example.com` })
      .expect(201);

    // Accept invitation
    const accepted = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({ token: inv.body.token, password: 'Senha@123456' })
      .expect(201);

    // Owner accesses company profile
    await request(app.getHttpServer())
      .get('/api/v1/company/profile')
      .set({ Authorization: `Bearer ${accepted.body.accessToken}` })
      .expect(200)
      .expect((r) => expect(r.body.tradeName).toBe(`Gesseiro ${uid}`));
  });
});
