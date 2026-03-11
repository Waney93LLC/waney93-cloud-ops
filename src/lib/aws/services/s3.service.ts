
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export class S3Service {
  constructor(private readonly s3Client: S3Client) {}

  async uploadFile(bucketName: string, key: string, body: Buffer | string): Promise<void> {
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      }));
    } catch (error) {
      console.error(`Error uploading file to S3: ${error}`);
      throw error;
    }
  }

  async getFile(bucketName: string, key: string): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));
      return await this.streamToBuffer(response.Body as Readable);
    } catch (error) {
      console.error(`Error getting file from S3: ${error}`);
      throw error;
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async checkObjectExists(bucketName: string, key: string): Promise<boolean> {
    try {
      await this.s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      console.error(`Error checking object existence in S3: ${error}`);
      throw error;
    }
  }
}