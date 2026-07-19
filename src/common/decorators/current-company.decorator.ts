import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().company,
);
