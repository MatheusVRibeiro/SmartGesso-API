import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('admin123');
  const emails = ['adm@adm.com', 'adm@admin.com', 'adm@admin'];

  // 1. PlatformAdmin
  for (const email of emails) {
    try {
      await prisma.platformAdmin.upsert({
        where: { email },
        update: { passwordHash, status: 'ACTIVE', name: 'Administrador' },
        create: {
          email,
          name: 'Administrador',
          passwordHash,
          status: 'ACTIVE',
        },
      });
      console.log(`[OK] PlatformAdmin: ${email}`);
    } catch (e: any) {
      console.log(`[Aviso] PlatformAdmin ${email}:`, e.message);
    }
  }

  // 2. Garantir Empresa ativa (Company)
  let company = await prisma.company.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        legalName: 'SmartGesso Matriz Ltda',
        tradeName: 'SmartGesso',
        documentType: 'CNPJ',
        document: '00.000.000/0001-99',
        status: 'ACTIVE',
        email: 'contato@smartgesso.com.br',
      },
    });
    console.log(`[OK] Empresa padrão criada: ${company.tradeName} (ID: ${company.id})`);
  } else {
    console.log(`[OK] Empresa encontrada: ${company.tradeName} (ID: ${company.id})`);
  }

  // 3. User para o Mobile / App
  for (const email of emails) {
    try {
      const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash, status: 'ACTIVE', name: 'Administrador' },
        create: {
          email,
          name: 'Administrador',
          passwordHash,
          status: 'ACTIVE',
        },
      });

      // Vincular como CompanyMember (Owner) da empresa
      await prisma.companyMember.upsert({
        where: {
          companyId_userId: {
            companyId: company.id,
            userId: user.id,
          },
        },
        update: {
          status: 'ATIVO',
          isOwner: true,
        },
        create: {
          companyId: company.id,
          userId: user.id,
          status: 'ATIVO',
          isOwner: true,
        },
      });

      console.log(`[OK] User & CompanyMember: ${email}`);
    } catch (e: any) {
      console.log(`[Aviso] User ${email}:`, e.message);
    }
  }
}

main()
  .catch((e) => {
    console.error('Erro na execução:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
