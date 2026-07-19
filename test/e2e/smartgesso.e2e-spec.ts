import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MemoryStore } from '../../src/database/memory.store';
describe('SmartGesso e2e multiempresa', () => {
  let app: INestApplication;
  let store: MemoryStore;
  let adminToken: string;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    store = app.get(MemoryStore);
  });
  beforeEach(async () => {
    store.reset();
    const login = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: 'admin@smartgesso.local', password: 'Admin@123456' });
    adminToken = login.body.accessToken;
  });
  afterAll(() => app.close());
  async function setupOwner(email: string, tradeName: string) {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const plan = await request(app.getHttpServer())
      .post('/api/v1/platform/plans')
      .set(auth)
      .send({
        name: `Plano ${tradeName}`,
        code: tradeName,
        defaultPrice: '100.00',
        maxUsers: 3,
        maxStorageMb: 100,
      });
    const c = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set(auth)
      .send({ legalName: tradeName, tradeName, document: tradeName });
    await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${c.body.id}/subscriptions`)
      .set(auth)
      .send({
        planId: plan.body.id,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
        agreedPrice: '100.00',
      });
    const inv = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${c.body.id}/owner-invitations`)
      .set(auth)
      .send({ name: tradeName, email });
    const acc = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({ token: inv.body.token, password: 'Senha@123456' });
    return { company: c.body, token: acc.body.accessToken };
  }
  it('blocks mobile user from platform routes and from unlinked company switch', async () => {
    const a = await setupOwner('a@example.com', 'EmpresaA');
    const b = await setupOwner('b@example.com', 'EmpresaB');
    await request(app.getHttpServer())
      .get('/api/v1/platform/companies')
      .set({ Authorization: `Bearer ${a.token}` })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/auth/switch-company')
      .set({ Authorization: `Bearer ${a.token}` })
      .send({ companyId: b.company.id })
      .expect(403);
  });
  it('suspended company can see access status but cannot operate', async () => {
    const a = await setupOwner('a@example.com', 'EmpresaA');
    await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${a.company.id}/suspend`)
      .set({ Authorization: `Bearer ${adminToken}` })
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
