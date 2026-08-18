// @ts-nocheck — pdfkit CommonJS, types incompletos
import { Injectable, NotFoundException } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import { PassThrough } from 'stream';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class QuotesPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePdf(quoteId: string, companyId: string): Promise<PassThrough> {
    // Buscar Quote com client, work, items
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

    // Buscar CompanyBranding da empresa
    const branding = await this.prisma.companyBranding.findUnique({
      where: { companyId },
    });

    // Criar stream de saída
    const stream = new PassThrough();

    // Criar documento PDF A4
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    // Conectar stream ao documento
    doc.pipe(stream);

    // Cores
    const primaryColor = branding?.primaryColor || '#333333';
    const lightGray = '#f5f5f5';
    const borderColor = '#dddddd';

    // Header com branding
    this.addHeader(doc, branding, primaryColor);

    // Título do orçamento
    this.addQuoteTitle(doc, quote, primaryColor);

    // Status badge
    this.addStatusBadge(doc, quote.status);

    // Informações do cliente e obra
    this.addClientInfo(doc, quote);

    // Tabela de itens
    this.addItemsTable(doc, quote.items, primaryColor);

    // Rodapé com totais
    this.addTotalsFooter(doc, quote, primaryColor);

    // Footer com informações da empresa
    this.addCompanyFooter(doc, branding);

    // Finalizar documento
    doc.end();

    return stream;
  }

  private addHeader(doc: PDFDocument, branding: any, primaryColor: string) {
    // Barra colorida no topo
    doc.rect(0, 0, 595.28, 60).fill(primaryColor);

    // Nome da empresa
    doc
      .fontSize(20)
      .fillColor('#ffffff')
      .text(branding?.displayName || 'SmartGesso', 50, 20, {
        align: 'left',
      });

    // Logo (se existir) - posição à direita
    if (branding?.logoUrl) {
      // Nota: Para imagens externas, seria necessário buscar a imagem
      // Por simplicidade, vamos apenas colocar o texto
    }

    // Resetar cor
    doc.fillColor('#000000');
  }

  private addQuoteTitle(
    doc: PDFDocument,
    quote: any,
    primaryColor: string,
  ) {
    doc
      .fontSize(18)
      .fillColor(primaryColor)
      .text(`Orçamento #${quote.quoteNumber} v${quote.version}`, 50, 80);

    doc.moveDown(0.5);
  }

  private addStatusBadge(doc: PDFDocument, status: string) {
    const statusMap: Record<string, string> = {
      RASCUNHO: 'Rascunho',
      ENVIADO: 'Enviado',
      APROVADO: 'Aprovado',
      REJEITADO: 'Rejeitado',
      CANCELADO: 'Cancelado',
    };

    const statusText = statusMap[status] || status;

    // Badge de status
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Status: ${statusText}`, 50, 110);

    doc.moveDown(0.5);
  }

  private addClientInfo(doc: PDFDocument, quote: any) {
    // Seção Cliente
    doc
      .fontSize(12)
      .fillColor('#333333')
      .text('Cliente', 50, 140)
      .fontSize(11)
      .fillColor('#666666')
      .text(`Nome: ${quote.client.name}`, 50, 155);

    if (quote.client.document) {
      doc.text(`Documento: ${quote.client.document}`, 50, 170);
    }

    // Seção Obra (se existir)
    if (quote.work) {
      doc
        .fontSize(12)
        .fillColor('#333333')
        .text('Obra', 50, 195)
        .fontSize(11)
        .fillColor('#666666')
        .text(`Nome: ${quote.work.name}`, 50, 210);
    }

    doc.moveDown(1);
  }

  private addItemsTable(
    doc: PDFDocument,
    items: any[],
    primaryColor: string,
  ) {
    const startY = 240;
    const tableWidth = 495;
    const colWidths = [100, 150, 60, 60, 60, 65]; // Tipo, Nome, Qtd, Un, Preço, Total
    const headers = ['Tipo', 'Nome', 'Qtd', 'Un', 'Preço Unit.', 'Total'];

    // Cabeçalho da tabela
    doc.rect(50, startY, tableWidth, 25).fill(primaryColor);

    let x = 55;
    headers.forEach((header, i) => {
      doc
        .fontSize(9)
        .fillColor('#ffffff')
        .text(header, x, startY + 7, { width: colWidths[i], align: 'center' });
      x += colWidths[i];
    });

    // Linhas da tabela
    let currentY = startY + 30;
    items.forEach((item, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
      doc.rect(50, currentY, tableWidth, 20).fill(bgColor);

      const tipoMap: Record<string, string> = {
        PRODUTO: 'Produto',
        SERVICO: 'Serviço',
        MATERIAL: 'Material',
        MAO_DE_OBRA: 'Mão de Obra',
        TRANSPORTE: 'Transporte',
      };

      x = 55;
      const rowData = [
        tipoMap[item.itemType] || item.itemType,
        item.name,
        item.quantity.toString(),
        item.unit,
        `R$ ${Number(item.unitPrice).toFixed(2)}`,
        `R$ ${Number(item.total).toFixed(2)}`,
      ];

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

      currentY += 20;
    });

    // Borda da tabela
    doc
      .rect(50, startY, tableWidth, currentY - startY)
      .lineWidth(1)
      .stroke('#dddddd');
  }

  private addTotalsFooter(doc: PDFDocument, quote: any, primaryColor: string) {
    const footerY = 600;

    // Subtotal
    doc
      .fontSize(11)
      .fillColor('#333333')
      .text('Subtotal:', 350, footerY)
      .text(`R$ ${Number(quote.subtotal).toFixed(2)}`, 450, footerY);

    // Desconto
    doc
      .text('Desconto:', 350, footerY + 20)
      .text(`- R$ ${Number(quote.discount).toFixed(2)}`, 450, footerY + 20);

    // Margem
    doc
      .text('Margem:', 350, footerY + 40)
      .text(`${Number(quote.marginPct).toFixed(2)}%`, 450, footerY + 40);

    // Total
    doc
      .fontSize(13)
      .fillColor(primaryColor)
      .text('Total:', 350, footerY + 70)
      .text(`R$ ${Number(quote.total).toFixed(2)}`, 450, footerY + 70);

    // Forma de pagamento
    const paymentMethodMap: Record<string, string> = {
      AVISTA: 'À Vista',
      AVISTA_DESCONTO: 'À Vista com Desconto',
      ENTRADA_SALDO: 'Entrada + Saldo',
      QUINZENAL_2X: 'Quinzenal (2x)',
      MENSAL: 'Mensal',
      PARCELADO: 'Parcelado',
      PERSONALIZADO: 'Personalizado',
    };

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(
        `Forma de Pagamento: ${paymentMethodMap[quote.paymentMethod] || quote.paymentMethod}`,
        50,
        footerY + 100,
      );

    // Observações
    if (quote.observations) {
      doc
        .text('Observações:', 50, footerY + 120)
        .text(quote.observations, 50, footerY + 135, {
          width: 400,
          align: 'left',
        });
    }
  }

  private addCompanyFooter(doc: PDFDocument, branding: any) {
    const footerY = 750;

    // Linha separadora
    doc
      .moveTo(50, footerY)
      .lineTo(545.28, footerY)
      .lineWidth(1)
      .stroke('#dddddd');

    // Informações da empresa
    if (branding?.quoteFooter) {
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(branding.quoteFooter, 50, footerY + 10, { width: 495 });
    }

    // Chave PIX
    if (branding?.pixKey) {
      doc
        .text(`Chave PIX: ${branding.pixKey}`, 50, footerY + 25, {
          width: 495,
        });
    }

    // Informações bancárias
    if (branding?.bankInformation) {
      doc.text(branding.bankInformation, 50, footerY + 40, { width: 495 });
    }
  }
}