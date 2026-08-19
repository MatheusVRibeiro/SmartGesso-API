// @ts-nocheck — pdfkit CommonJS, types incompletos
import { Injectable, NotFoundException } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import { PassThrough } from 'stream';
import { PrismaService } from '../../database/prisma.service';
import { isSafeLogoUrl } from './safe-logo-url';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 495.28
const BOTTOM_LIMIT = PAGE_HEIGHT - 60; // 781.89

const PAYMENT_METHOD_MAP: Record<string, string> = {
  AVISTA: 'À Vista',
  AVISTA_DESCONTO: 'À Vista com Desconto',
  ENTRADA_SALDO: 'Entrada + Saldo',
  QUINZENAL_2X: 'Quinzenal (2x)',
  MENSAL: 'Mensal',
  PARCELADO: 'Parcelado',
  PERSONALIZADO: 'Personalizado',
};

const PAYMENT_TERMS_MAP: Record<string, string> = {
  AVISTA: 'À Vista',
  AVISTA_DESCONTO: 'À Vista com Desconto',
  ENTRADA_SALDO: 'Entrada + Saldo',
  PARCELADO: 'Parcelado',
  QUINZENAL: 'Quinzenal (2x)',
  MENSAL: 'Mensal',
  PERSONALIZADO: 'Personalizado',
};

const STATUS_MAP: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PRONTO_PARA_ENVIAR: 'Pronto para enviar',
  ENVIADO: 'Enviado',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  REJEITADO: 'Não aprovado',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

const TIPO_MAP: Record<string, string> = {
  PRODUTO: 'Produto',
  SERVICO: 'Serviço',
  MATERIAL: 'Material',
  MAO_DE_OBRA: 'Mão de Obra',
  TRANSPORTE: 'Transporte',
};

/** Formata data como dd/mm/aaaa (UTC — datas de negócio são date-only). */
function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Formata valor monetário em BRL (R$ 1.234,56). */
function formatBRL(value: number | string | { toString(): string }): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

/** Formata CPF (11 dígitos) ou CNPJ (14 dígitos). */
function formatDocument(document: string): string {
  const digits = document.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return document;
}

/** Formata endereço da empresa em linha única legível. */
function formatAddress(addr: any): string {
  const parts: string[] = [];
  const street = [addr.street, addr.number].filter(Boolean).join(', ');
  if (street) parts.push(street);
  if (addr.complement) parts.push(addr.complement);
  if (addr.district) parts.push(addr.district);
  const cityState = [addr.city, addr.state].filter(Boolean).join('/');
  if (cityState) parts.push(cityState);
  if (addr.postalCode) parts.push(`CEP ${addr.postalCode}`);
  return parts.join(' - ');
}

@Injectable()
export class QuotesPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(quoteId: string, companyId: string): Promise<PassThrough> {
    // Snapshot imutável: o PDF é gerado sob demanda com os dados atuais do
    // orçamento — nenhum PDF antigo é armazenado ou regenerado.
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, document: true } },
        work: { select: { id: true, name: true } },
        items: true,
      },
    });

    if (!quote) {
      throw new NotFoundException('Orçamento não encontrado');
    }

    // Identidade da empresa (Company + CompanyBranding + endereço)
    const [company, branding] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        include: { addresses: true },
      }),
      this.prisma.companyBranding.findUnique({ where: { companyId } }),
    ]);

    const stream = new PassThrough();

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `Orçamento #${quote.quoteNumber} v${quote.version}`,
        Author: branding?.displayName || company?.tradeName || 'SmartGesso',
      },
    });

    doc.pipe(stream);

    const primaryColor = branding?.primaryColor || '#333333';

    // Logo (opcional — falha silenciosa mantém o PDF sem logo)
    const logo = await this.loadLogo(doc, branding?.logoUrl);

    let y = this.addHeader(doc, branding, company, primaryColor, logo);
    y = this.addCompanyIdentity(doc, branding, company, primaryColor, y);
    y = this.addQuoteTitle(doc, quote, primaryColor, y);
    y = this.addClientInfo(doc, quote, y);
    y = this.addDeadlineSection(doc, quote, primaryColor, y);
    y = this.addCommercialSection(doc, quote, branding, primaryColor, y);
    y = this.addItemsTable(doc, quote.items, primaryColor, y);
    y = this.addTotalsFooter(doc, quote, primaryColor, y);
    y = this.addObservations(doc, quote, y);
    this.addCompanyFooter(doc, branding, y);

    doc.end();

    return stream;
  }

  /** Adiciona página se o espaço restante não comportar o bloco. */
  private ensureSpace(doc: PDFDocument, y: number, needed: number): number {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      return MARGIN;
    }
    return y;
  }

  /** Busca a logo (URL remota ou data URI) e decodifica para inserção no PDF. */
  private async loadLogo(
    doc: PDFDocument,
    logoUrl?: string | null,
  ): Promise<{ buffer: Buffer; width: number; height: number } | null> {
    if (!logoUrl) return null;
    try {
      let buffer: Buffer;
      if (logoUrl.startsWith('data:')) {
        const b64 = logoUrl.split(',')[1] || '';
        buffer = Buffer.from(b64, 'base64');
      } else {
        if (!(await isSafeLogoUrl(logoUrl))) return null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const resp = await fetch(logoUrl, { signal: controller.signal });
          if (!resp.ok) return null;
          buffer = Buffer.from(await resp.arrayBuffer());
        } finally {
          clearTimeout(timer);
        }
      }
      const img = doc.openImage(buffer);
      return { buffer, width: img.width, height: img.height };
    } catch {
      return null; // logo é opcional — nunca quebra o PDF
    }
  }

  /** Barra colorida do topo com nome da empresa e logo à direita. */
  private addHeader(
    doc: PDFDocument,
    branding: any,
    company: any,
    primaryColor: string,
    logo: { buffer: Buffer; width: number; height: number } | null,
  ): number {
    doc.rect(0, 0, PAGE_WIDTH, 60).fill(primaryColor);

    const name = branding?.displayName || company?.tradeName || 'SmartGesso';
    doc.fontSize(18).fillColor('#ffffff').text(name, MARGIN, 18, {
      width: 400,
    });

    if (logo) {
      const maxH = 40;
      const maxW = 140;
      let w = logo.width;
      let h = logo.height;
      const scale = Math.min(maxW / w, maxH / h, 1);
      w *= scale;
      h *= scale;
      doc.image(logo.buffer, PAGE_WIDTH - MARGIN - w, (60 - h) / 2, {
        width: w,
        height: h,
      });
    }

    doc.fillColor('#000000');
    return 70;
  }

  /** Identidade da empresa: nome fantasia, razão social, CNPJ, contatos, endereço. */
  private addCompanyIdentity(
    doc: PDFDocument,
    branding: any,
    company: any,
    primaryColor: string,
    y: number,
  ): number {
    const name = branding?.displayName || company?.tradeName || 'SmartGesso';
    doc.fontSize(13).fillColor(primaryColor).text(name, MARGIN, y, {
      width: CONTENT_WIDTH,
    });
    y += 18;

    if (company?.legalName && company.legalName !== name) {
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text(company.legalName, MARGIN, y, { width: CONTENT_WIDTH });
      y += 13;
    }

    const docLabel =
      company?.documentType === 'CPF' ? 'CPF' : 'CNPJ';
    const identityParts: string[] = [];
    if (company?.document) {
      identityParts.push(`${docLabel}: ${formatDocument(company.document)}`);
    }
    if (company?.phone) identityParts.push(`Tel: ${company.phone}`);
    if (company?.whatsapp) identityParts.push(`WhatsApp: ${company.whatsapp}`);
    if (identityParts.length) {
      doc
        .fontSize(9)
        .fillColor('#444444')
        .text(identityParts.join('   |   '), MARGIN, y, {
          width: CONTENT_WIDTH,
        });
      y += 13;
    }

    const contactParts: string[] = [];
    if (company?.email) contactParts.push(company.email);
    if (branding?.website) contactParts.push(branding.website);
    if (branding?.instagram) contactParts.push(branding.instagram);
    if (contactParts.length) {
      doc
        .fontSize(9)
        .fillColor('#444444')
        .text(contactParts.join('   |   '), MARGIN, y, {
          width: CONTENT_WIDTH,
        });
      y += 13;
    }

    const addr = company?.addresses?.[0];
    if (addr) {
      doc
        .fontSize(9)
        .fillColor('#444444')
        .text(formatAddress(addr), MARGIN, y, { width: CONTENT_WIDTH });
      y += 13;
    }

    y += 6;
    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .lineWidth(0.5)
      .stroke('#dddddd');
    return y + 10;
  }

  private addQuoteTitle(
    doc: PDFDocument,
    quote: any,
    primaryColor: string,
    y: number,
  ): number {
    doc
      .fontSize(16)
      .fillColor(primaryColor)
      .text(`Orçamento #${quote.quoteNumber} v${quote.version}`, MARGIN, y);
    y += 22;

    const statusText = STATUS_MAP[quote.status] || quote.status;
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Status: ${statusText}`, MARGIN, y);
    return y + 18;
  }

  private addClientInfo(doc: PDFDocument, quote: any, y: number): number {
    doc.fontSize(11).fillColor('#333333').text('Cliente', MARGIN, y);
    y += 15;

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Nome: ${quote.client.name}`, MARGIN, y);
    y += 14;

    if (quote.client.document) {
      doc
        .text(`Documento: ${formatDocument(quote.client.document)}`, MARGIN, y);
      y += 14;
    }

    if (quote.localAddress) {
      const la = quote.localAddress as any;
      const street = la.rua && la.numero ? `${la.rua}, ${la.numero}` : la.rua;
      const cityState =
        la.cidade && la.estado ? `${la.cidade}/${la.estado}` : la.cidade;
      const localParts = [street, la.bairro, cityState].filter(Boolean);
      if (localParts.length) {
        doc
          .text(`Local: ${localParts.join(' - ')}`, MARGIN, y, {
            width: CONTENT_WIDTH,
          });
        y += 14;
      }
    }

    if (quote.work) {
      doc.fontSize(11).fillColor('#333333').text('Obra', MARGIN, y);
      y += 15;
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(`Nome: ${quote.work.name}`, MARGIN, y);
      y += 14;
    }

    return y + 8;
  }

  /** Seção Prazo (V3 §54): início, prazo estimado, conclusão, entrega. */
  private addDeadlineSection(
    doc: PDFDocument,
    quote: any,
    primaryColor: string,
    y: number,
  ): number {
    const hasPrazo =
      quote.startDate ||
      quote.durationDays != null ||
      quote.endDate ||
      quote.deadlineDate;
    if (!hasPrazo) return y;

    y = this.ensureSpace(doc, y, 90);
    doc.fontSize(11).fillColor(primaryColor).text('Prazo', MARGIN, y);
    y += 16;

    const lines: Array<[string, string]> = [];
    if (quote.startDate) {
      lines.push(['Previsão de início', formatDate(quote.startDate)]);
    }
    if (quote.durationDays != null) {
      lines.push([
        'Prazo estimado',
        `${quote.durationDays} dia${quote.durationDays === 1 ? '' : 's'}`,
      ]);
    }
    if (quote.endDate) {
      lines.push(['Previsão de conclusão', formatDate(quote.endDate)]);
    }
    if (quote.deadlineDate) {
      lines.push(['Entregar até', formatDate(quote.deadlineDate)]);
    }

    for (const [label, value] of lines) {
      doc.fontSize(10).fillColor('#333333').text(label, MARGIN, y);
      doc
        .fontSize(10)
        .fillColor('#333333')
        .text(value, MARGIN + 170, y);
      y += 15;
    }

    return y + 6;
  }

  /** Seção comercial: pagamento (forma + condições), garantia e validade. */
  private addCommercialSection(
    doc: PDFDocument,
    quote: any,
    branding: any,
    primaryColor: string,
    y: number,
  ): number {
    const paymentLabel = quote.paymentMethod
      ? PAYMENT_METHOD_MAP[quote.paymentMethod] || quote.paymentMethod
      : null;
    const termsLabel = quote.paymentTerms
      ? PAYMENT_TERMS_MAP[quote.paymentTerms] || quote.paymentTerms
      : null;
    const warranty =
      quote.warrantyDays != null
        ? `${quote.warrantyDays} dia${quote.warrantyDays === 1 ? '' : 's'} de garantia`
        : branding?.defaultWarrantyText || null;
    const validade = quote.validUntil
      ? `Válido até ${formatDate(quote.validUntil)}`
      : null;

    if (!paymentLabel && !termsLabel && !warranty && !validade) return y;

    y = this.ensureSpace(doc, y, 90);
    doc.fontSize(11).fillColor(primaryColor).text('Pagamento', MARGIN, y);
    y += 16;

    const rows: Array<[string, string]> = [];
    if (paymentLabel) rows.push(['Forma de pagamento', paymentLabel]);
    if (termsLabel) rows.push(['Condições', termsLabel]);
    if (warranty) rows.push(['Garantia', warranty]);
    if (validade) rows.push(['Validade', validade]);

    for (const [label, value] of rows) {
      doc.fontSize(10).fillColor('#333333').text(label, MARGIN, y);
      doc
        .fontSize(10)
        .fillColor('#333333')
        .text(value, MARGIN + 170, y);
      y += 15;
    }

    return y + 6;
  }

  /** Tabela de itens com quebra de página e cabeçalho repetido. */
  private addItemsTable(
    doc: PDFDocument,
    items: any[],
    primaryColor: string,
    y: number,
  ): number {
    const colWidths = [90, 150, 50, 50, 70, 85]; // soma = 495
    const headers = ['Tipo', 'Nome', 'Qtd', 'Un', 'Preço Unit.', 'Total'];
    const headerH = 24;
    const rowH = 20;

    const drawHeader = (yy: number) => {
      doc.rect(MARGIN, yy, CONTENT_WIDTH, headerH).fill(primaryColor);
      let x = MARGIN + 5;
      headers.forEach((header, i) => {
        doc
          .fontSize(9)
          .fillColor('#ffffff')
          .text(header, x, yy + 7, { width: colWidths[i], align: 'center' });
        x += colWidths[i];
      });
    };

    const startY = this.ensureSpace(
      doc,
      y,
      headerH + rowH * Math.min(items.length, 3) + 40,
    );
    drawHeader(startY);
    let currentY = startY + headerH;

    if (items.length === 0) {
      doc
        .rect(MARGIN, currentY, CONTENT_WIDTH, rowH)
        .fill('#f9f9f9');
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text('Nenhum item', MARGIN + 5, currentY + 5, {
          width: CONTENT_WIDTH,
        });
      currentY += rowH;
    } else {
      items.forEach((item, index) => {
        if (currentY + rowH > BOTTOM_LIMIT) {
          doc.addPage();
          currentY = MARGIN;
          drawHeader(currentY);
          currentY += headerH;
        }

        const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowH).fill(bgColor);

        const rowData = [
          TIPO_MAP[item.itemType] || item.itemType,
          item.name,
          String(item.quantity),
          item.unit || '',
          formatBRL(item.unitPrice),
          formatBRL(item.total),
        ];

        let x = MARGIN + 5;
        rowData.forEach((data, i) => {
          doc
            .fontSize(9)
            .fillColor('#333333')
            .text(data, x, currentY + 5, {
              width: colWidths[i],
              align: 'center',
            });
          x += colWidths[i];
        });

        currentY += rowH;
      });
    }

    doc
      .rect(MARGIN, startY, CONTENT_WIDTH, currentY - startY)
      .lineWidth(0.5)
      .stroke('#dddddd');

    return currentY + 10;
  }

  private addTotalsFooter(
    doc: PDFDocument,
    quote: any,
    primaryColor: string,
    y: number,
  ): number {
    y = this.ensureSpace(doc, y, 100);
    const labelX = MARGIN + 250;
    const valueX = MARGIN + 370;

    doc.fontSize(10).fillColor('#333333').text('Subtotal:', labelX, y);
    doc.text(formatBRL(quote.subtotal), valueX, y);
    y += 18;

    doc.text('Desconto:', labelX, y);
    doc.text(`- ${formatBRL(quote.discount)}`, valueX, y);
    y += 18;

    doc.text('Margem:', labelX, y);
    doc.text(`${Number(quote.marginPct).toFixed(2)}%`, valueX, y);
    y += 22;

    doc.fontSize(13).fillColor(primaryColor).text('Total:', labelX, y);
    doc.text(formatBRL(quote.total), valueX, y);

    return y + 16;
  }

  private addObservations(
    doc: PDFDocument,
    quote: any,
    y: number,
  ): number {
    if (!quote.observations) return y;

    y = this.ensureSpace(doc, y, 60);
    doc.fontSize(10).fillColor('#333333').text('Observações:', MARGIN, y);
    y += 14;
    doc
      .fontSize(9)
      .fillColor('#555555')
      .text(quote.observations, MARGIN, y, { width: CONTENT_WIDTH });
    return doc.y + 10;
  }

  /** Rodapé com informações comerciais da empresa (V3 §55). */
  private addCompanyFooter(doc: PDFDocument, branding: any, y: number) {
    let footerY = Math.max(y + 10, PAGE_HEIGHT - 110);
    if (footerY > BOTTOM_LIMIT - 40) {
      doc.addPage();
      footerY = MARGIN;
    }

    doc
      .moveTo(MARGIN, footerY)
      .lineTo(PAGE_WIDTH - MARGIN, footerY)
      .lineWidth(0.5)
      .stroke('#dddddd');

    let fy = footerY + 10;
    if (branding?.quoteFooter) {
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(branding.quoteFooter, MARGIN, fy, { width: CONTENT_WIDTH });
      fy = doc.y + 4;
    }
    if (branding?.pixKey) {
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(`Chave PIX: ${branding.pixKey}`, MARGIN, fy, {
          width: CONTENT_WIDTH,
        });
      fy = doc.y + 4;
    }
    if (branding?.bankInformation) {
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(branding.bankInformation, MARGIN, fy, { width: CONTENT_WIDTH });
    }
  }
}