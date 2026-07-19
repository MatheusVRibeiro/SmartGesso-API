import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Base repository helpers for stage 2.
 *
 * The next feature services should depend on this Prisma-backed layer instead of MemoryStore.
 * It centralizes tenant scoping and Decimal conversion so company data is always queried with
 * the authenticated `companyId` and financial values never use float/double.
 */
@Injectable()
export class PrismaRepositoryService {
  constructor(protected readonly prisma: PrismaService) {}

  tenantScope<T extends object>(companyId: string, where?: T): T & { companyId: string } {
    return { ...(where ?? ({} as T)), companyId };
  }

  money(value: string | number | Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
}
