import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Branding,
  Company,
  Installment,
  Invitation,
  Member,
  Plan,
  PlatformAdmin,
  Subscription,
  User,
} from '../domain';
@Injectable()
export class MemoryStore {
  platformAdmins = new Map<string, PlatformAdmin>();
  companies = new Map<string, Company>();
  brandings = new Map<string, Branding>();
  plans = new Map<string, Plan>();
  subscriptions = new Map<string, Subscription>();
  installments = new Map<string, Installment>();
  users = new Map<string, User>();
  members = new Map<string, Member>();
  invitations = new Map<string, Invitation>();
  audit: unknown[] = [];
  id() {
    return randomUUID();
  }
  reset() {
    this.platformAdmins.clear();
    this.companies.clear();
    this.brandings.clear();
    this.plans.clear();
    this.subscriptions.clear();
    this.installments.clear();
    this.users.clear();
    this.members.clear();
    this.invitations.clear();
    this.audit = [];
  }
}
