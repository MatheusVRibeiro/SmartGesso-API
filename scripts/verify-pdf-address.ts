/* Script de verificação: insere endereço de teste na empresa (rodar com tsx dentro do projeto). */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = 'f0e62672-acc9-4e50-83bf-57e780e47dc5';
  const existing = await prisma.companyAddress.findFirst({ where: { companyId } });
  if (existing) {
    console.log('Address already exists:', existing.id);
    return;
  }
  const addr = await prisma.companyAddress.create({
    data: {
      companyId,
      type: 'PRINCIPAL',
      postalCode: '01000-000',
      street: 'Rua das Acácias',
      number: '123',
      complement: 'Sala 2',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      country: 'BR',
    },
  });
  console.log('Address created:', addr.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());