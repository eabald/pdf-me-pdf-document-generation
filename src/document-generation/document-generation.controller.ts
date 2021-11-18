import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DocumentGenerationService } from './document-generation.service';
import { GenerateDocumentDto } from '@eabald/pdf-me-shared';

@Controller('document-generation')
export class DocumentGenerationController {
  constructor(
    private readonly documentGenerationService: DocumentGenerationService,
  ) {}

  @MessagePattern({ cmd: 'document-generation-generate' })
  async generateDocument(@Payload() payload: GenerateDocumentDto) {
    return this.documentGenerationService.generate(payload);
  }
}
