import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Testes e2e do fluxo completo da API SmartGesso.
 *
 * Cobertura: login → clientes → obras → catálogo → medições →
 * composições → orçamentos → PDF → OS → produção → pagamentos → despesas
 *
 * Regras:
 *  - NÃO depende de dados pré-existentes (cria empresa + usuário via platform)
 *  - Todos os dados de teste usam prefixo TESTE-E2E-
 *  - Rodar: NODE_ENV=test npx jest --config test/jest-e2e.json --testPathPattern=api-flow
 */
describe('SmartGesso API — fluxo completo e2e', () => {
  let app: INestApplication;

  // ── Platform admin (seed real) ────────────────────────────────────────
  const ADMIN_EMAIL =
    process.env.SEED_PLATFORM_ADMIN_EMAIL || 'admin@smartgesso.local';
  const ADMIN_PASSWORD = 'SmartGesso@2026';

  // ── Prefixo único por execução ────────────────────────────────────────
  const TS = Date.now();
  const PREFIX = `TESTE-E2E-${TS}`;
  const USER_PASSWORD = 'Senha@123456';

  // ── IDs coletados ao longo do fluxo ──────────────────────────────────
  let adminToken: string;
  let userToken: string;
  let companyId: string;
  let clientId: string;
  let workId: string;
  let productId: string;
  let materialId: string;
  let measurementId: string;
  let quoteId: string;
  let serviceOrderId: string;
  let productionOrderId: string;
  let paymentId: string;
  let expenseId: string;

  // ── Helpers ──────────────────────────────────────────────────────────
  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  // ── Setup ────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    // 1) Login como admin da plataforma
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(201);

    adminToken = adminLogin.body.accessToken;

    // 2) Criar plano único
    const plan = await request(app.getHttpServer())
      .post('/api/v1/platform/plans')
      .set(auth(adminToken))
      .send({
        name: `Plano ${PREFIX}`,
        code: `PLAN-${PREFIX}`,
        defaultPrice: '199.00',
        maxUsers: 5,
        maxStorageMb: 2048,
      })
      .expect(201);

    // 3) Criar empresa única
    const company = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set(auth(adminToken))
      .send({
        legalName: `Empresa ${PREFIX}`,
        tradeName: `Empresa ${PREFIX}`,
        document: `DOC-${PREFIX}`,
      })
      .expect(201);

    companyId = company.body.id;

    // 4) Criar assinatura
    await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${companyId}/subscriptions`)
      .set(auth(adminToken))
      .send({
        planId: plan.body.id,
        startDate: '2026-01-01',
        endDate: '2027-12-31',
        agreedPrice: '199.00',
      })
      .expect(201);

    // 5) Convidar proprietário
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${companyId}/owner-invitations`)
      .set(auth(adminToken))
      .send({ name: `Dono ${PREFIX}`, email: `${PREFIX}@teste.local` })
      .expect(201);

    // 6) Aceitar convite → token do usuário
    const accepted = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({ token: invite.body.token, password: USER_PASSWORD })
      .expect(201);

    userToken = accepted.body.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. AUTH — login
  // ═══════════════════════════════════════════════════════════════════════

  describe('Auth', () => {
    it('GET /auth/me retorna dados do usuário autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(auth(userToken))
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(`${PREFIX}@teste.local`);
    });

    it('POST /auth/login com credenciais válidas retorna accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${PREFIX}@teste.local`, password: USER_PASSWORD })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(`${PREFIX}@teste.local`);
      expect(res.body.activeCompanyId).toBe(companyId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. CLIENTES
  // ═══════════════════════════════════════════════════════════════════════

  describe('Clientes', () => {
    it('GET /clients lista clientes (pode ser vazio)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/clients')
        .set(auth(userToken))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /clients cria cliente TESTE-E2E', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/clients')
        .set(auth(userToken))
        .send({
          type: 'JURIDICA',
          name: `${PREFIX} - Cliente Teste`,
          document: `CNPJ-${PREFIX}`,
          email: `cliente-${PREFIX}@teste.local`,
          phone: '11999998888',
          whatsapp: '11999998888',
          observations: 'Cliente criado para teste e2e',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(`${PREFIX} - Cliente Teste`);
      expect(res.body.type).toBe('JURIDICA');
      clientId = res.body.id;
    });

    it('GET /clients/:id retorna o cliente criado', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/clients/${clientId}`)
        .set(auth(userToken))
        .expect(200);

      expect(res.body.id).toBe(clientId);
      expect(res.body.name).toContain(PREFIX);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. OBRAS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Obras', () => {
    it('GET /works lista obras (pode ser vazio)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/works')
        .set(auth(userToken))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /works cria obra TESTE-E2E vinculada ao cliente', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/works')
        .set(auth(userToken))
        .send({
          clientId,
          name: `${PREFIX} - Obra Teste`,
          reference: 'REF-001',
          street: 'Rua Teste',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
          status: 'PLANEJADA',
          observations: 'Obra criada para teste e2e',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(`${PREFIX} - Obra Teste`);
      expect(res.body.clientId).toBe(clientId);
      expect(res.body.status).toBe('PLANEJADA');
      workId = res.body.id;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. CATÁLOGO — produtos e materiais
  // ═══════════════════════════════════════════════════════════════════════

  describe('Catálogo', () => {
    it('POST /catalog/products cria produto TESTE-E2E', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(auth(userToken))
        .send({
          name: `${PREFIX} - Placa de Gesso 120x240`,
          description: 'Placa de gesso acartonado para parede/septo',
          unit: 'm²',
          price: 45.9,
          cost: 32.0,
          status: 'ACTIVE',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain(PREFIX);
      productId = res.body.id;
    });

    it('POST /catalog/materials cria material TESTE-E2E (para preço da composição)', async () => {
      // Material com nome que CONTÉM "Placa de Gesso" (para lookup LIKE no cálculo)
      const res = await request(app.getHttpServer())
        .post('/api/v1/catalog/materials')
        .set(auth(userToken))
        .send({
          name: 'Placa de Gesso',
          description: 'Placa de gesso acartonado 120x240cm',
          unit: 'm²',
          price: 45.9,
          cost: 32.0,
          status: 'ACTIVE',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      materialId = res.body.id;
    });

    it('GET /catalog/products lista produtos incluindo o criado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((p: any) => p.id === productId)).toBe(true);
    });

    it('GET /catalog/materials lista materiais incluindo o criado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/materials')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((m: any) => m.id === materialId)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. MEDIÇÕES
  // ═══════════════════════════════════════════════════════════════════════

  describe('Medições', () => {
    it('POST /works/:workId/measurements cria medição TESTE-E2E', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/works/${workId}/measurements`)
        .set(auth(userToken))
        .send({
          environmentName: `${PREFIX} - Sala 01`,
          applicationType: 'DRYWALL',
          length: 5.0,
          width: 4.0,
          doors: 1,
          windows: 2,
          hasCove: false,
          hasDropCeiling: false,
          observations: 'Medição de teste e2e',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.environmentName).toBe(`${PREFIX} - Sala 01`);
      expect(Number(res.body.area)).toBe(20); // 5 × 4
      measurementId = res.body.id;
    });

    it('GET /works/:workId/measurements lista medições da obra', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/works/${workId}/measurements`)
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((m: any) => m.id === measurementId)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. COMPOSIÇÕES — cálculo de materiais
  // ═══════════════════════════════════════════════════════════════════════

  describe('Composições', () => {
    it('GET /compositions lista composições (inclui seed DRYWALL)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/compositions')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((c: any) => c.code === 'DRYWALL')).toBe(true);
    });

    it('POST /compositions/calculate retorna 7 itens calculados', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/compositions/calculate')
        .set(auth(userToken))
        .send({
          applicationType: 'DRYWALL',
          measurements: [
            { length: 5.0, width: 4.0, perimeter: 18.0 },   // area=20, peri=18
            { length: 3.0, width: 6.0, perimeter: 18.0 },   // area=18, peri=18 → total area=38, peri=36
          ],
        })
        .expect(201);

      expect(res.body.composition.code).toBe('DRYWALL');
      expect(res.body.items.length).toBe(7);
      expect(Number(res.body.totalArea)).toBe(38);
      expect(Number(res.body.estimatedCost)).toBeGreaterThanOrEqual(0);

      // Validar que cada item tem campos obrigatórios
      for (const item of res.body.items) {
        expect(item.materialType).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.unit).toBeDefined();
        // quantity pode ser 0 para itens sem material correspondente no catálogo
        expect(Number(item.quantity)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. ORÇAMENTOS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Orçamentos', () => {
    it('POST /quotes cria orçamento com totais calculados', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set(auth(userToken))
        .send({
          clientId,
          workId,
          discount: 50,
          marginPct: 10,
          paymentMethod: 'AVISTA',
          observations: 'Orçamento teste e2e',
          items: [
            {
              itemType: 'MATERIAL',
              name: 'Placa de Gesso',
              quantity: 38,
              unit: 'm²',
              unitPrice: 45.9,
            },
            {
              itemType: 'MAO_DE_OBRA',
              name: 'Instalação',
              quantity: 38,
              unit: 'm²',
              unitPrice: 25.0,
            },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.quoteNumber).toBeGreaterThan(0);
      expect(res.body.status).toBe('RASCUNHO');

      // Validar totais: subtotal = (38×45.9) + (38×25) = 1744.2 + 950 = 2694.2
      const expectedSubtotal = 38 * 45.9 + 38 * 25.0;
      expect(Number(res.body.subtotal)).toBeCloseTo(expectedSubtotal, 1);
      expect(Number(res.body.discount)).toBe(50);
      expect(Number(res.body.marginPct)).toBe(10);

      // total = subtotal - discount + (subtotal × marginPct/100)
      const expectedTotal =
        expectedSubtotal - 50 + expectedSubtotal * 0.1;
      expect(Number(res.body.total)).toBeCloseTo(expectedTotal, 1);

      expect(res.body.items.length).toBe(2);
      quoteId = res.body.id;
    });

    it('GET /quotes lista orçamentos incluindo o criado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/quotes')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((q: any) => q.id === quoteId)).toBe(true);
    });

    it('GET /quotes/:id retorna orçamento com itens', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/quotes/${quoteId}`)
        .set(auth(userToken))
        .expect(200);

      expect(res.body.id).toBe(quoteId);
      expect(res.body.items.length).toBe(2);
      expect(res.body.client.name).toContain(PREFIX);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. PDF DO ORÇAMENTO
  // ═══════════════════════════════════════════════════════════════════════

  describe('PDF do Orçamento', () => {
    it('GET /quotes/:id/pdf retorna PDF válido', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/quotes/${quoteId}/pdf`)
        .set(auth(userToken))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      // PDF inicia com %PDF
      expect(res.body[0]).toBe(0x25); // '%'
      expect(res.body[1]).toBe(0x50); // 'P'
      expect(res.body[2]).toBe(0x44); // 'D'
      expect(res.body[3]).toBe(0x46); // 'F'
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 9. ORDENS DE SERVIço
  // ═══════════════════════════════════════════════════════════════════════

  describe('Ordens de Serviço', () => {
    it('POST /service-orders cria OS TESTE-E2E', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/service-orders')
        .set(auth(userToken))
        .send({
          clientId,
          workId,
          status: 'PENDENTE',
          scheduledDate: '2026-09-15T09:00:00.000Z',
          observations: 'OS teste e2e',
          materials: [
            { materialName: 'Placa de Gesso', quantity: 40, unit: 'm²' },
            { materialName: 'Perfil Metálico', quantity: 80, unit: 'm' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBeGreaterThan(0);
      expect(res.body.status).toBe('PENDENTE');
      expect(res.body.materials.length).toBe(2);
      serviceOrderId = res.body.id;
    });

    it('GET /service-orders lista OS incluindo a criada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/service-orders')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((o: any) => o.id === serviceOrderId)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 10. ORDENS DE PRODUÇÃO
  // ═══════════════════════════════════════════════════════════════════════

  describe('Ordens de Produção', () => {
    it('POST /production-orders cria OP TESTE-E2E', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/production-orders')
        .set(auth(userToken))
        .send({
          clientId,
          workId,
          dueDate: '2026-09-20T18:00:00.000Z',
          responsiblePerson: 'João Teste',
          observations: 'OP teste e2e',
          items: [
            { productName: 'Placa de Gesso 120x240', quantity: 20, unit: 'm²' },
            { productName: 'Perfil U-50', quantity: 50, unit: 'm' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBeGreaterThan(0);
      expect(res.body.status).toBe('PENDENTE');
      expect(res.body.responsiblePerson).toBe('João Teste');
      expect(res.body.items.length).toBe(2);
      productionOrderId = res.body.id;
    });

    it('GET /production-orders lista OPs incluindo a criada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/production-orders')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((o: any) => o.id === productionOrderId)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 11. PAGAMENTOS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Pagamentos', () => {
    it('POST /payments cria pagamento TESTE-E2E', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set(auth(userToken))
        .send({
          clientId,
          quoteId,
          amount: 500.0,
          paymentMethod: 'PIX',
          paymentDate: '2026-08-18T10:00:00.000Z',
          status: 'CONFIRMADO',
          notes: 'Pagamento teste e2e',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(Number(res.body.amount)).toBe(500);
      expect(res.body.paymentMethod).toBe('PIX');
      expect(res.body.status).toBe('CONFIRMADO');
      paymentId = res.body.id;
    });

    it('GET /payments lista pagamentos incluindo o criado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((p: any) => p.id === paymentId)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 12. DESPESAS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Despesas', () => {
    it('POST /expenses cria despesa TESTE-E2E', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/expenses')
        .set(auth(userToken))
        .send({
          category: 'MATERIAL',
          description: `${PREFIX} - Compra de material para obra`,
          amount: 1250.75,
          expenseDate: '2026-08-18T14:00:00.000Z',
          observations: 'Despesa teste e2e',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.category).toBe('MATERIAL');
      expect(Number(res.body.amount)).toBe(1250.75);
      expect(res.body.description).toContain(PREFIX);
      expenseId = res.body.id;
    });

    it('GET /expenses lista despesas incluindo a criada', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/expenses')
        .set(auth(userToken))
        .expect(200);

      const list = Array.isArray(res.body) ? res.body : res.body.data;
      expect(list.some((e: any) => e.id === expenseId)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // RESUMO
  // ═══════════════════════════════════════════════════════════════════════

  describe('Resumo do fluxo', () => {
    it('todos os IDs foram coletados com sucesso', () => {
      expect(companyId).toBeDefined();
      expect(clientId).toBeDefined();
      expect(workId).toBeDefined();
      expect(productId).toBeDefined();
      expect(materialId).toBeDefined();
      expect(measurementId).toBeDefined();
      expect(quoteId).toBeDefined();
      expect(serviceOrderId).toBeDefined();
      expect(productionOrderId).toBeDefined();
      expect(paymentId).toBeDefined();
      expect(expenseId).toBeDefined();
    });
  });
});
