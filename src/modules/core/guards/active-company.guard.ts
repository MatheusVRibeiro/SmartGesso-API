import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { permissionsForRole } from '../company-permissions';

@Injectable()
export class ActiveCompanyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const companyId = req.companyId;
    const userId = req.user?.id;

    if (!userId || !companyId)
      throw new ForbiddenException('Empresa ativa não selecionada ou sem vínculo');

    const [member, company] = await Promise.all([
      this.prisma.companyMember.findFirst({
        where: {
          userId,
          companyId,
          status: 'ATIVO',
        },
      }),
      this.prisma.company.findFirst({
        where: {
          id: companyId,
          deletedAt: null,
        },
      }),
    ]);

    if (!member || !company)
      throw new ForbiddenException('Empresa ativa não selecionada ou sem vínculo');

    // Permissões derivadas do perfil (role) do membro — V3 seção 57
    const permissions = permissionsForRole(member.role);

    req.company = company;
    req.member = {
      ...member,
      permissions,
    };
    return true;
  }
}
