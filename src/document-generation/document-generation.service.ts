import { Injectable, Inject, HttpStatus, Logger } from '@nestjs/common';
import { GenerateDocumentDto, InvoiceEntity } from '@pdf-me/shared';
import { InjectContext } from 'nest-puppeteer';
import { BrowserContext, PDFOptions } from 'puppeteer';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import Handlebars from 'handlebars';
import { promises } from 'fs';

@Injectable()
export class DocumentGenerationService {
  private readonly logger = new Logger(DocumentGenerationService.name);
  constructor(
    @InjectContext() private readonly browserContext: BrowserContext,
    @Inject('TEMPLATES_SERVICE') private templatesService: ClientProxy,
    @Inject('FILES_SERVICE') private filesService: ClientProxy,
    @Inject('LIMITS_SERVICE') private limitsService: ClientProxy,
    @Inject('INVOICES_SERVICE') private invoicesService: ClientProxy,
  ) {}
  async generate(data: GenerateDocumentDto) {
    // check limit
    const limit = await this.limitsService
      .send({ cmd: 'limits-check' }, data.userId)
      .toPromise();
    if (limit > 0) {
      throw new RpcException({
        message: 'Limit exceeded',
        statusCode: HttpStatus.PAYMENT_REQUIRED,
      });
    }
    // compile template
    const template = await this.templatesService
      .send({ cmd: 'templates-get-by-id' }, data.templateId)
      .toPromise();
    const file = await this.generateDocument(template.content, data.content);
    // save file
    const fileRecord = await this.filesService
      .send({ cmd: 'files-save' }, { userId: data.userId, file })
      .toPromise();
    // decrease limit
    await this.limitsService
      .send({ cmd: 'limits-reduce' }, data.userId)
      .toPromise();
    // return file id
    return fileRecord;
  }

  async generateDocument(templateContent: string, data: any) {
    const content = await Handlebars.compile(templateContent)(data);
    // get browser
    const page = await this.browserContext.newPage();
    // generate document
    const pdfOptions: PDFOptions = {
      format: 'a4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    };
    await page.goto(`data: text/html, ${content}`, {
      waitUntil: 'networkidle0',
    });
    await page.setContent(content);
    await page.emulateMediaType('screen');
    const file = await page.pdf(pdfOptions);
    return file;
  }

  async generateInvoices() {
    const invoicesToGenerate: InvoiceEntity[] = await this.invoicesService
      .send({ cmd: 'payments-get-invoices-to-generate' }, null)
      .toPromise();
    const generated = {};
    const invoiceTemplate = await promises.readFile(
      '../templates/invoice.htm',
      'utf-8',
    );
    invoicesToGenerate.forEach(async (invoice) => {
      try {
        const fileBuffer = await this.generateDocument(
          invoiceTemplate,
          invoice,
        );
        const { Key } = await this.filesService
          .send('files-create', fileBuffer)
          .toPromise();
        generated[invoice.id] = Key;
      } catch (error) {
        this.logger.log(`Invoice generation failed: ${error}`);
      }
    });
    await this.invoicesService.send(
      { cmd: 'payments-set-generated-invoices' },
      generated,
    );
  }
}
