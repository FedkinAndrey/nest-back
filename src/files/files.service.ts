import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import PublicFile from './publicFile.entity';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'; // AWS SDK v3
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { fromEnv } from '@aws-sdk/credential-provider-env';

@Injectable()
export class FilesService {
  private readonly s3Client: S3Client;

  constructor(
    @InjectRepository(PublicFile)
    private publicFilesRepository: Repository<PublicFile>,
    private readonly configService: ConfigService,
  ) {
    // Initialize S3Client with credentials from environment variables
    this.s3Client = new S3Client({
      credentials: fromEnv(),
      region: this.configService.get<string>('AWS_REGION'), // AWS region
    });
  }

  async uploadPublicFile(dataBuffer: Buffer, filename: string) {
    const bucketName = this.configService.get<string>('AWS_PUBLIC_BUCKET_NAME');
    const key = `${uuid()}-${filename}`;

    // Create the S3 command to upload the file
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Body: dataBuffer,
      Key: key,
    });

    // Upload file to S3
    const uploadResult = await this.s3Client.send(uploadCommand);

    // Save file information to the database
    const newFile = this.publicFilesRepository.create({
      key: key,
      url: `https://${bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`, // Generate the URL manually
    });
    await this.publicFilesRepository.save(newFile);

    return newFile;
  }

  async deletePublicFile(fileId: number) {
    const file = await this.publicFilesRepository.findOne({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Create the S3 command to delete the file
    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.configService.get<string>('AWS_PUBLIC_BUCKET_NAME'),
      Key: file.key,
    });

    // Send the command to delete the file from S3
    await this.s3Client.send(deleteCommand);

    // Remove the file record from the database
    await this.publicFilesRepository.delete(fileId);
  }

  async deletePublicFileWithQueryRunner(
    fileId: number,
    queryRunner: QueryRunner,
  ) {
    const file = await queryRunner.manager.findOne(PublicFile, {
      where: { id: fileId },
    });
    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.configService.get<string>('AWS_PUBLIC_BUCKET_NAME'),
      Key: file.key,
    });

    // Send the command to delete the file from S3
    await this.s3Client.send(deleteCommand);
    await queryRunner.manager.delete(PublicFile, fileId);
  }
}
