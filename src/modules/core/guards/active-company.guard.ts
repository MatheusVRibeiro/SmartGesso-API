import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

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
          status: 'ACTIVE',
        },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
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

    // Carregar permissões do member via MemberRole -> Role -> RolePermission -> Permission
    const permissions = new Set<string>();
    for (const mr of member.roles) {
      for (const rp of mr.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    req.company = company;
    req.member = {
      ...member,
      permissions: [...permissions],
    };
    return true;
  }
}
