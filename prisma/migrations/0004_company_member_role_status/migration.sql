-- Migration: CompanyMember role/status V3 (seção 57 — Usuários e permissões)
-- 1) Adiciona coluna role (CompanyUserRole) em CompanyMember
-- 2) Converte status de UserStatus para CompanyMemberStatus (ATIVO/INATIVO/CONVIDADO)
-- 3) Remove tabelas RBAC antigas (Role, Permission, MemberRole, RolePermission) — não utilizadas

-- 1) role
ALTER TABLE `CompanyMember`
  ADD COLUMN `role` ENUM('COMPANY_OWNER','MANAGER','SALES','FINANCE','INSTALLER','PRODUCTION') NOT NULL DEFAULT 'MANAGER';

-- Proprietários existentes recebem COMPANY_OWNER
UPDATE `CompanyMember` SET `role` = 'COMPANY_OWNER' WHERE `isOwner` = 1;

-- 2) status: converte valores antigos (UserStatus) para o novo enum (CompanyMemberStatus)
ALTER TABLE `CompanyMember` MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'CONVIDADO';
UPDATE `CompanyMember` SET `status` = 'ATIVO' WHERE `status` IN ('ACTIVE');
UPDATE `CompanyMember` SET `status` = 'INATIVO' WHERE `status` IN ('INACTIVE', 'BLOCKED');
UPDATE `CompanyMember` SET `status` = 'CONVIDADO' WHERE `status` IN ('INVITED');
ALTER TABLE `CompanyMember` MODIFY `status` ENUM('ATIVO','INATIVO','CONVIDADO') NOT NULL DEFAULT 'CONVIDADO';

-- 3) Remove tabelas RBAC antigas (não referenciadas por código)
DROP TABLE IF EXISTS `RolePermission`;
DROP TABLE IF EXISTS `MemberRole`;
DROP TABLE IF EXISTS `Role`;
DROP TABLE IF EXISTS `Permission`;