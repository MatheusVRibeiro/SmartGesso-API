import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator que extrai companyId do request autenticado.
 * Uso: @CurrentCompany() companyId: string
 */
export const CurrentCompany = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const company = request.company;
    if (!company?.id) {
      throw new Error('CurrentCompany decorator: company not found in request. Ensure ActiveCompanyGuard is applied.');
    }
    return company.id;
  },
);
