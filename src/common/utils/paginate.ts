import { PaginationDto, PaginatedResponseDto } from '../dto/pagination.dto';

/**
 * Paginação genérica para entidades Prisma.
 * Usage: await paginate(prisma.quote, { companyId }, paginationDto, { createdAt: 'desc' });
 */
type FindManyCount = {
  findMany: (args?: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
};

export async function paginate<T>(
  prisma: FindManyCount,
  where: Record<string, any>,
  pagination: PaginationDto,
  orderBy?: Record<string, 'asc' | 'desc'>,
  include?: Record<string, any>,
): Promise<PaginatedResponseDto<T>> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: orderBy ?? { createdAt: 'desc' },
      ...(include ? { include } : {}),
    }),
    prisma.count({ where }),
  ]);

  return new PaginatedResponseDto<T>(data as T[], total, page, pageSize);
}
