import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

// Hybrid ESM/CJS path resolution
let currentDir = "";
try {
  const metaUrl = typeof import.meta !== "undefined" ? (import.meta as any)["url"] : undefined;
  if (metaUrl) {
    currentDir = path.dirname(fileURLToPath(metaUrl));
  } else {
    currentDir = __dirname;
  }
} catch {
  currentDir = __dirname;
}

export class StorageService {
  private localUploadDir: string;

  constructor() {
    this.localUploadDir = path.join(currentDir, "data/uploads");
    if (!fs.existsSync(this.localUploadDir)) {
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }
  }

  /**
   * Uploads a file buffer and returns its resolved URL.
   */
  public async uploadFile(
    fileName: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const hasS3Config =
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET;

    if (hasS3Config) {
      try {
        console.log(`[Storage] S3 configured. Attempting upload of ${fileName}...`);
        // Dynamically import AWS SDK using require-like dynamic import casted to any
        const awsSdk = (await import("@aws-sdk/client-s3" as any)) as any;
        const S3Client = awsSdk.S3Client;
        const PutObjectCommand = awsSdk.PutObjectCommand;
        
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "ap-south-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        const uniqueKey = `${Date.now()}-${crypto.randomUUID()}-${fileName}`;
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: uniqueKey,
            Body: buffer,
            ContentType: mimeType,
          })
        );

        const regionStr = process.env.AWS_REGION ? `s3.${process.env.AWS_REGION}.amazonaws.com` : "s3.amazonaws.com";
        const url = `https://${process.env.AWS_S3_BUCKET}.${regionStr}/${uniqueKey}`;
        console.log(`[Storage] S3 Upload successful: ${url}`);
        return url;
      } catch (err) {
        console.warn("[Storage] S3 Upload failed, falling back to local storage:", err);
      }
    }

    // Local Disk Fallback
    console.log(`[Storage] Local fallback. Writing ${fileName} to disk...`);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueKey = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${sanitizedName}`;
    const destinationPath = path.join(this.localUploadDir, uniqueKey);

    fs.writeFileSync(destinationPath, buffer);
    const appUrl = process.env.APP_URL || "http://localhost:" + (process.env.PORT || "3005");
    const resolvedUrl = `${appUrl}/api/storage/files/${uniqueKey}`;
    console.log(`[Storage] Local upload successful: ${resolvedUrl}`);
    return resolvedUrl;
  }

  /**
   * Serve local uploads path for Express middleware static queries.
   */
  public getLocalUploadDirectory(): string {
    return this.localUploadDir;
  }
}

export const storageService = new StorageService();
