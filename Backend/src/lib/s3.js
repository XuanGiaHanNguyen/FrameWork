// backend/src/lib/s3.js
// ─── S3 CLIENT + HELPERS ──────────────────────────────────────────────────────
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

// S3 key convention: notebooks/<notebookId>/<filename>
export const fileKey = (notebookId, filename) =>
  `notebooks/${notebookId}/${filename}`;

// ── Upload a buffer to S3 ──────────────────────────────────────────────────────
export async function uploadFile({ notebookId, filename, buffer, mimeType }) {
  const key = fileKey(notebookId, filename);
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
  }));
  return key;
}

// ── Delete a single S3 object ─────────────────────────────────────────────────
export async function deleteFile(s3Key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
}

// ── Delete ALL objects under a notebook prefix ────────────────────────────────
// Used when a notebook is deleted to purge every file in one go.
export async function deleteNotebookFiles(notebookId) {
  const prefix = `notebooks/${notebookId}/`;

  // List everything under the prefix (handles >1000 objects via pagination)
  let ContinuationToken;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: prefix, ContinuationToken,
    }));

    const objects = (list.Contents || []).map(o => ({ Key: o.Key }));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: objects, Quiet: true },
      }));
    }

    ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

// ── Generate a short-lived presigned GET URL (download link) ──────────────────
export async function presignedGetUrl(s3Key, expiresIn = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    { expiresIn },
  );
}

// ── Stream an S3 object body as a Buffer (for re-ingestion) ───────────────────
export async function downloadFileBuffer(s3Key) {
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const chunks = [];
  for await (const chunk of resp.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}