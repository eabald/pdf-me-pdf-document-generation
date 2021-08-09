import { Module } from '@nestjs/common';
import * as Joi from '@hapi/joi';
import { ConfigModule } from '@nestjs/config';
import { PuppeteerModule } from 'nest-puppeteer';
import { DocumentGenerationModule } from './document-generation/document-generation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        RABBITMQ_USER: Joi.string(),
        RABBITMQ_PASSWORD: Joi.string(),
        RABBITMQ_HOST: Joi.string(),
      }),
    }),
    PuppeteerModule.forRoot({
      pipe: true,
    }),
    DocumentGenerationModule,
  ],
})
export class AppModule {}
