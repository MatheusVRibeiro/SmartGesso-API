import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
async function main() {
  const email = process.env.SEED_PLATFORM_ADMIN_EMAIL || 'admin@smartgesso.local';
  const name = process.env.SEED_PLATFORM_ADMIN_NAME || 'Admin SmartGesso';
  const password = process.env.SEED_PLATFORM_ADMIN_PASSWORD || 'Admin@123456';
  await prisma.platformAdmin.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash: await argon2.hash(password), status: 'ACTIVE' },
  });
}
main().finally(() => prisma.$disconnect());
