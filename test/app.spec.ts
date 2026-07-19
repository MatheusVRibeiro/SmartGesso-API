import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { MemoryStore } from '../src/database/memory.store';
describe('SmartGesso API unit flow', () => {
  let app: INestApplication;
  let store: MemoryStore;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    store = app.get(MemoryStore);
  });
  beforeEach(() => store.reset());
  afterAll(() => app.close());
  it('admin creates company, subscription, installments, payment and owner accesses active company', async () => {
    const admin = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: 'admin@smartgesso.local', password: 'Admin@123456' })
      .expect(201);
    const auth = { Authorization: `Bearer ${admin.body.accessToken}` };
    const plan = await request(app.getHttpServer())
      .post('/api/v1/platform/plans')
      .set(auth)
      .send({
        name: 'Profissional',
        code: 'PRO',
        defaultPrice: '200.00',
        maxUsers: 5,
        maxStorageMb: 2048,
      })
      .expect(201);
    const company = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set(auth)
      .send({ legalName: 'Gesseiro Lucas LTDA', tradeName: 'Gesseiro Lucas', document: '123' })
      .expect(201);
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
    const installments = await request(app.getHttpServer())
      .post(`/api/v1/platform/subscriptions/${sub.body.id}/installments/generate`)
      .set(auth)
      .send({ count: 6, amount: '1200.00', firstDueDate: '2026-08-10' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/subscription-installments/${installments.body[0].id}/payments`)
      .set(auth)
      .send({ amount: '200.00', paymentMethod: 'PIX' })
      .expect(201);
    const inv = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${company.body.id}/owner-invitations`)
      .set(auth)
      .send({ name: 'Lucas', email: 'lucas@example.com' })
      .expect(201);
    const accepted = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({ token: inv.body.token, password: 'Senha@123456' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/company/profile')
      .set({ Authorization: `Bearer ${accepted.body.accessToken}` })
      .expect(200)
      .expect((r) => expect(r.body.tradeName).toBe('Gesseiro Lucas'));
  });
});
