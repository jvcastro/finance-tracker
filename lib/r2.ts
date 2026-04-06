import "server-only"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const bucket = process.env.R2_BUCKET
const endpoint = process.env.R2_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

function requireR2(): { client: S3Client; bucket: string } {
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured (R2_BUCKET, R2_ENDPOINT, keys).")
  }
  const client = new S3Client({
    region: "auto",
    endpoint: endpoint.startsWith("http") ? endpoint : `https://${endpoint}`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
  return { client, bucket }
}

export async function deleteR2Object(key: string): Promise<void> {
  const { client, bucket: b } = requireR2()
  try {
    await client.send(new DeleteObjectCommand({ Bucket: b, Key: key }))
  } catch {
    // ignore
  }
}

export async function putObjectBuffer(params: {
  key: string
  contentType: string
  body: Buffer
}): Promise<void> {
  const { client, bucket: b } = requireR2()
  await client.send(
    new PutObjectCommand({
      Bucket: b,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  )
}

export async function presignGet(key: string): Promise<string> {
  const { client, bucket: b } = requireR2()
  const cmd = new GetObjectCommand({ Bucket: b, Key: key })
  return getSignedUrl(client, cmd, { expiresIn: 900 })
}

export async function headObjectExists(key: string): Promise<boolean> {
  const { client, bucket: b } = requireR2()
  try {
    await client.send(new HeadObjectCommand({ Bucket: b, Key: key }))
    return true
  } catch {
    return false
  }
}
