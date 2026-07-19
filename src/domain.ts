export type Status = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'INVITED';
export type SubscriptionStatus =
  'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
export type BillingType = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM';
export type InstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  status: Status;
  refreshTokenHash?: string;
  lastLoginAt?: Date;
}
export interface Company {
  id: string;
  legalName: string;
  tradeName: string;
  documentType: string;
  document: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  status: Status;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface Branding {
  id: string;
  companyId: string;
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  commercialEmail?: string;
  commercialPhone?: string;
  commercialWhatsapp?: string;
  website?: string;
  instagram?: string;
  quoteFooter?: string;
  defaultWarrantyText?: string;
  pixKey?: string;
  bankInformation?: string;
  showSmartGessoBrand: boolean;
}
export interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  billingType: BillingType;
  defaultPrice: string;
  maxUsers: number;
  maxStorageMb: number;
  features: string[];
  showSmartGessoBrand: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}
export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  startDate: Date;
  endDate: Date;
  gracePeriodEnd: Date;
  status: SubscriptionStatus;
  billingType: BillingType;
  agreedPrice: string;
  autoRenew: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  suspendedAt?: Date;
  suspensionReason?: string;
  reactivatedAt?: Date;
  createdByPlatformAdminId: string;
}
export interface Installment {
  id: string;
  subscriptionId: string;
  companyId: string;
  installmentNumber: number;
  description: string;
  amount: string;
  dueDate: Date;
  paidAmount: string;
  paidAt?: Date;
  status: InstallmentStatus;
  paymentMethod?: string;
  externalReference?: string;
  notes?: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  status: Status;
  refreshTokenHash?: string;
  activeCompanyId?: string;
}
export interface Member {
  id: string;
  companyId: string;
  userId: string;
  status: Status;
  isOwner: boolean;
  permissions: string[];
  joinedAt: Date;
}
export interface Invitation {
  id: string;
  companyId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
}
export const OWNER_PERMISSIONS = [
  'company.read',
  'company.update',
  'company.branding.read',
  'company.branding.update',
  'members.read',
  'members.invite',
  'members.update',
  'members.disable',
  'clients.read',
  'clients.create',
  'clients.update',
  'clients.archive',
  'catalog.read',
  'catalog.create',
  'catalog.update',
  'measurements.read',
  'measurements.create',
  'measurements.update',
  'compositions.read',
  'compositions.create',
  'compositions.update',
  'quotes.read',
  'quotes.create',
  'quotes.update',
  'quotes.approve',
  'quotes.cancel',
  'quotes.discount',
  'quotes.view_cost',
  'quotes.generate_pdf',
  'services.read',
  'services.create',
  'services.update',
  'services.complete',
  'production.read',
  'production.create',
  'production.update',
  'customer_payments.read',
  'customer_payments.create',
  'customer_payments.reverse',
  'customer_collections.read',
  'customer_collections.create',
  'expenses.read',
  'expenses.create',
  'expenses.update',
  'inventory.read',
  'inventory.create',
  'inventory.adjust',
  'reports.read',
  'reports.export',
];
