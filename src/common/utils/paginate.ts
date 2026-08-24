import { PaginationDto, PaginatedResponseDto } from '../dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';

/**
 * Paginação genérica para entidades Prisma.
 * Usage: await paginate(prisma.quote, { companyId }, paginationDto, { createdAt: 'desc' });
 */
export async function paginate<T>(
  prisma: { findMany: Function; count: Function },
  where: Record<string, any>,
  pagination: PaginationDto,
  orderBy?: Record<string, 'asc' | 'desc'>,
): Promise<PaginatedResponseDto<T>> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.findMany({ where, skip, take: pageSize, orderBy: orderBy ?? { createdAt: 'desc' } }),
    prisma.count({ where }),
  ]);

  return new PaginatedResponseDto<T>(data as T[], total, page, pageSize);
}
