import { Injectable, Inject } from '@nestjs/common';
import { GenerateDocumentDto } from '@pdf-me/shared';
import { InjectContext } from 'nest-puppeteer';
import { BrowserContext, PDFOptions } from 'puppeteer';
import { ClientProxy } from '@nestjs/microservices';
import Handlebars from 'handlebars';

@Injectable()
export class DocumentGenerationService {
  constructor(
    @InjectContext() private readonly browserContext: BrowserContext,
    @Inject('TEMPLATES_SERVICE') private templatesService: ClientProxy,
    @Inject('FILES_SERVICE') private filesService: ClientProxy,
  ) {}
  async generate(data: GenerateDocumentDto) {
    // compile template
    const template = await this.templatesService
      .send({ cmd: 'templates-get-by-id' }, data.templateId)
      .toPromise();
    const content = await Handlebars.compile(template.content)(data.content);
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
    // save file
    const fileRecord = await this.filesService
      .send({ cmd: 'files-save' }, { userId: data.userId, file })
      .toPromise();
    // return file id
    return fileRecord;
  }
}
