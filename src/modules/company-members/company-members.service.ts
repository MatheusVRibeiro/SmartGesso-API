import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { permissionsForRole } from '../core/company-permissions';
import { InviteMemberDto, UpdateMemberDto } from './dto';

/**
 * Usuários da empresa (CompanyMember) — V3 seção 57.
 * companyId SEMPRE vem do contexto autenticado (r.company.id), nunca do body.
 */
@Injectable()
export class CompanyMembersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista membros da empresa com dados do usuário (nome, email, role, status). */
  async findAll(companyId: string) {
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      include: { user: true },
      orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
    });
    return members.map((m) => this.toMemberDto(m));
  }

  /**
   * Convida um usuário: cria User (se não existir) + CompanyMember status CONVIDADO.
   * Retorna o membro e os dados do convite gerado.
   */
  async invite(companyId: string, dto: InviteMemberDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Usuário ainda não existe: cria com senha provisória inutilizável (status INVITED)
      const placeholderHash = await argon2.hash(randomUUID());
      const user = await this.prisma.user.create({
        data: {
          name: dto.name?.trim() || email.split('@')[0],
          email,
          passwordHash: placeholderHash,
          status: 'INVITED',
        },
      });
      userId = user.id;
    }

    const existingMember = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });

    let member;
    if (existingMember) {
      member = await this.prisma.companyMember.update({
        where: { id: existingMember.id },
        data: { role: dto.role, status: 'CONVIDADO' },
        include: { user: true },
      });
    } else {
      member = await this.prisma.companyMember.create({
        data: { companyId, userId, role: dto.role, status: 'CONVIDADO' },
        include: { user: true },
      });
    }

    return {
      member: this.toMemberDto(member),
      invite: {
        email,
        role: member.role,
        status: member.status,
        inviteToken: randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    };
  }

  /** Atualiza role/status de um membro (scoped pela empresa). */
  async update(companyId: string, id: string, dto: UpdateMemberDto) {
    const member = await this.findOne(companyId, id);
    if (dto.status === 'INATIVO' && member.isOwner) {
      throw new BadRequestException(
        'Não é possível desativar o proprietário da empresa',
      );
    }
    const updated = await this.prisma.companyMember.update({
      where: { id },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { user: true },
    });
    return this.toMemberDto(updated);
  }

  /** Ativa um membro (status ATIVO + joinedAt). */
  async activate(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const updated = await this.prisma.companyMember.update({
      where: { id },
      data: { status: 'ATIVO', joinedAt: new Date() },
      include: { user: true },
    });
    return this.toMemberDto(updated);
  }

  /** Desativa um membro (status INATIVO). */
  async deactivate(companyId: string, id: string) {
    const member = await this.findOne(companyId, id);
    if (member.isOwner) {
      throw new BadRequestException(
        'Não é possível desativar o proprietário da empresa',
      );
    }
    const updated = await this.prisma.companyMember.update({
      where: { id },
      data: { status: 'INATIVO' },
      include: { user: true },
    });
    return this.toMemberDto(updated);
  }

  /** Remove um membro da empresa (scoped pela empresa). */
  async remove(companyId: string, id: string) {
    const member = await this.findOne(companyId, id);
    if (member.isOwner) {
      throw new BadRequestException(
        'Não é possível remover o proprietário da empresa',
      );
    }
    await this.prisma.companyMember.delete({ where: { id } });
    return { removed: true, id };
  }

  /** Permissões do usuário atual na empresa (role + lista de permissões). */
  async permissions(companyId: string, userId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { companyId, userId },
    });
    if (!member) {
      throw new NotFoundException('Vínculo com a empresa não encontrado');
    }
    return {
      role: member.role,
      status: member.status,
      permissions: permissionsForRole(member.role),
    };
  }

  /** Busca membro scoped pela empresa (404 se não existir). */
  private async findOne(companyId: string, id: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { id, companyId },
      include: { user: true },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    return member;
  }

  /** Projeção pública do membro + dados do usuário. */
  private toMemberDto(m: {
    id: string;
    companyId: string;
    userId: string;
    role: string;
    status: string;
    isOwner: boolean;
    joinedAt: Date | null;
    createdAt: Date;
    user?: { name: string; email: string } | null;
  }) {
    return {
      id: m.id,
      companyId: m.companyId,
      userId: m.userId,
      name: m.user?.name ?? null,
      email: m.user?.email ?? null,
      role: m.role,
      status: m.status,
      isOwner: m.isOwner,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
    };
  }
}