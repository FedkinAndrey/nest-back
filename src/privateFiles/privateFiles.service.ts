import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'; // AWS SDK v3
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import PrivateFile from './privateFile.entity';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class PrivateFilesService {
  private readonly s3Client: S3Client;

  constructor(
    @InjectRepository(PrivateFile)
    private privateFilesRepository: Repository<PrivateFile>,
    private readonly configService: ConfigService,
  ) {
    // Initialize S3Client with credentials from environment variables
    this.s3Client = new S3Client({
      credentials: fromEnv(),
      region: this.configService.get<string>('AWS_REGION'), // AWS region
      endpoint: `https://s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com`, // Set regional endpoint
    });
  }

  async uploadPrivateFile(
    dataBuffer: Buffer,
    ownerId: number,
    filename: string,
  ) {
    const bucketName = this.configService.get<string>(
      'AWS_PRIVATE_BUCKET_NAME',
    );
    const key = `${uuid()}-${filename}`;

    // Create S3 upload command
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Body: dataBuffer,
      Key: key,
    });

    // Upload file to S3 using the S3Client
    const uploadResult = await this.s3Client.send(uploadCommand);

    // Save file information to the database
    const newFile = this.privateFilesRepository.create({
      key: key,
      owner: {
        id: ownerId,
      },
    });
    await this.privateFilesRepository.save(newFile);
    return newFile;
  }

  public async getPrivateFile(fileId: number) {
    // const s3 = new S3();

    const fileInfo = await this.privateFilesRepository.findOne({
      where: { id: fileId },
      relations: ['owner'],
    });

    if (fileInfo) {
      try {
        // Create a command to retrieve the object from S3
        const getObjectCommand = new GetObjectCommand({
          Bucket: this.configService.get<string>('AWS_PRIVATE_BUCKET_NAME'),
          Key: fileInfo.key,
        });

        // Send the command to S3 and retrieve the response
        const s3Response = await this.s3Client.send(getObjectCommand);

        // The Body returned by GetObjectCommand is a Readable stream
        const stream = s3Response.Body as Readable;

        return {
          stream,
          info: fileInfo,
        };
      } catch (error) {
        throw new NotFoundException('File not found in S3');
      }
    }
    throw new NotFoundException();
  }

  public async generatePresignedUrl(key: string) {
    const bucketName = this.configService.get<string>(
      'AWS_PRIVATE_BUCKET_NAME',
    );

    // Create the GetObjectCommand with the key
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    // Generate the presigned URL using the getSignedUrl function
    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // URL expiration time in seconds (1 hour)
    });

    return presignedUrl;
  }
}
