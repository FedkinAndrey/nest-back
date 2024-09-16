import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ExcludeNullInterceptor } from './utils/excludeNull.interceptor';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { fromEnv } from '@aws-sdk/credential-provider-env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global pipes and interceptors
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new ExcludeNullInterceptor());
  app.use(cookieParser());

  // Fetch AWS credentials from environment variables using ConfigService
  const configService = app.get(ConfigService);

  // Set environment variables for AWS credentials and region
  process.env.AWS_ACCESS_KEY_ID = configService.get('AWS_ACCESS_KEY_ID');
  process.env.AWS_SECRET_ACCESS_KEY = configService.get(
    'AWS_SECRET_ACCESS_KEY',
  );
  process.env.AWS_REGION = configService.get('AWS_REGION');

  // Initialize AWS S3 Client (you can adjust this for other AWS services)
  const s3Client = new S3Client({
    credentials: fromEnv(), // Get credentials from environment variables
    region: process.env.AWS_REGION, // Use region from environment variables
  });

  // Start the NestJS application
  await app.listen(3000);

  console.log('NestJS application is running on port 3000');
}

bootstrap();
