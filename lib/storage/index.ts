import "server-only";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { db, type Tx } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { BusinessRuleError, ValidationError } from "@/lib/auth/errors";
import { getSetting } from "@/lib/settings/service";
import { BUCKETS, type Bucket } from "./buckets";

export { BUCKETS, type Bucket } from "./buckets";

export type DocumentEntity = (typeof documents.$inferInsert)["entityType"];

const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes (spec §2.4)

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Extensions whose magic bytes are not detectable (text/containers) – validated by extension only. */
const TEXT_LIKE = new Set(["msg", "eml", "csv", "txt", "svg", "dxf"]);
const EXECUTABLE_MIME = new Set(["application/x-msdownload", "application/x-executable", "application/x-elf", "application/x-mach-binary", "application/x-sh", "application/vnd.microsoft.portable-executable"]);

export interface UploadInput {
  bucket: Bucket;
  entityType: DocumentEntity;
  entityId: string;
  file: File;
  documentType?: string | null;
  uploadedBy: string;
  supersedesDocumentId?: string | null;
  /** allow only these extensions (defaults to settings.files.allowed_extensions) */
  allowedExtensions?: string[];
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

/** Validate size, extension and real MIME (magic bytes) – spec §2.4 #4, #8. */
export async function validateFile(file: File, allowed?: string[]): Promise<{ mime: string; ext: string; buffer: Buffer }> {
  const files = await getSetting("files");
  const allowedExt = allowed ?? files.allowed_extensions;
  const ext = extensionOf(file.name);
  if (!allowedExt.includes(ext)) throw new ValidationError("files.extension_not_allowed", { file: ["files.extension_not_allowed"] });
  if (file.size > files.max_size_mb * 1024 * 1024) throw new ValidationError("files.too_large", { file: ["files.too_large"] });
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  if (detected && EXECUTABLE_MIME.has(detected.mime)) throw new ValidationError("files.executable_rejected", { file: ["files.executable_rejected"] });
  if (!detected && !TEXT_LIKE.has(ext)) throw new ValidationError("files.type_mismatch", { file: ["files.type_mismatch"] });
  if (detected) {
    const detectedExt = detected.ext === "cfb" ? (ext === "doc" || ext === "xls" || ext === "msg" ? ext : detected.ext) : detected.ext;
    const compatible: Record<string, string[]> = { jpg: ["jpg", "jpeg"], jpeg: ["jpg", "jpeg"], docx: ["docx"], xlsx: ["xlsx"], zip: ["zip", "docx", "xlsx", "dwg"], pdf: ["pdf"], png: ["png"], dwg: ["dwg"], dxf: ["dxf"] };
    const okExts = compatible[detectedExt] ?? [detectedExt];
    if (!okExts.includes(ext)) throw new ValidationError("files.type_mismatch", { file: ["files.type_mismatch"] });
  }
  return { mime: detected?.mime ?? file.type ?? "application/octet-stream", ext, buffer };
}

/** Path: {yyyy}/{entity_type}/{entity_id}/{document_id}__{ascii-safe original name} */
export function buildStoragePath(entityType: string, entityId: string, documentId: string, originalName: string): string {
  const yyyy = new Date().getFullYear();
  const safe = originalName.replace(/[^\w.\-]+/g, "_").slice(-100);
  return `${yyyy}/${entityType}/${entityId}/${documentId}__${safe}`;
}

export async function uploadDocument(input: UploadInput, tx: Tx | typeof db = db): Promise<{ id: string; storagePath: string }> {
  const { mime, buffer } = await validateFile(input.file, input.allowedExtensions);
  const id = crypto.randomUUID();
  const storagePath = buildStoragePath(input.entityType, input.entityId, id, input.file.name);
  const sb = supabase();
  const { error } = await sb.storage.from(input.bucket).upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (error) throw new BusinessRuleError("files.upload_failed", error.message);
  let version = 1;
  if (input.supersedesDocumentId) {
    const prev = await tx.select({ version: documents.version }).from(documents).where(eq(documents.id, input.supersedesDocumentId));
    version = (prev[0]?.version ?? 0) + 1;
  }
  await tx.insert(documents).values({
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    documentType: input.documentType ?? null,
    fileName: input.file.name,
    storageBucket: input.bucket,
    storagePath,
    mimeType: mime,
    sizeBytes: input.file.size,
    version,
    supersedesDocumentId: input.supersedesDocumentId ?? null,
    uploadedBy: input.uploadedBy,
    createdBy: input.uploadedBy,
  });
  return { id, storagePath };
}

/** Upload raw bytes generated by the system (PDF, xlsx). */
export async function uploadGenerated(opts: { bucket: Bucket; entityType: DocumentEntity; entityId: string; fileName: string; mime: string; bytes: Buffer; documentType?: string; userId: string | null; pathOverride?: string }, tx: Tx | typeof db = db) {
  const id = crypto.randomUUID();
  const storagePath = opts.pathOverride ?? buildStoragePath(opts.entityType, opts.entityId, id, opts.fileName);
  const sb = supabase();
  const { error } = await sb.storage.from(opts.bucket).upload(storagePath, opts.bytes, { contentType: opts.mime, upsert: true });
  if (error) throw new BusinessRuleError("files.upload_failed", error.message);
  await tx.insert(documents).values({
    id,
    entityType: opts.entityType,
    entityId: opts.entityId,
    documentType: opts.documentType ?? null,
    fileName: opts.fileName,
    storageBucket: opts.bucket,
    storagePath,
    mimeType: opts.mime,
    sizeBytes: opts.bytes.length,
    uploadedBy: opts.userId,
    createdBy: opts.userId,
  });
  return { id, storagePath };
}

export async function signedUrl(bucket: string, path: string, downloadName?: string): Promise<string> {
  const sb = supabase();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS, downloadName ? { download: downloadName } : undefined);
  if (error || !data) throw new BusinessRuleError("files.sign_failed", error?.message);
  return data.signedUrl;
}

export async function downloadBytes(bucket: string, path: string): Promise<Buffer> {
  const sb = supabase();
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) throw new BusinessRuleError("files.download_failed", error?.message);
  return Buffer.from(await data.arrayBuffer());
}

/** Idempotently create the private buckets (run from setup script / first cron). */
export async function ensureBuckets() {
  const sb = supabase();
  const { data } = await sb.storage.listBuckets();
  const existing = new Set((data ?? []).map((b) => b.name));
  for (const b of BUCKETS) if (!existing.has(b)) await sb.storage.createBucket(b, { public: false });
}

/**
 * Lists the buckets with the service key – the cheapest call that proves the key is accepted.
 * A malformed key surfaces here as the storage API's own message ("Invalid Compact JWS" for a
 * key that is not a JWT), which is what an invoice upload would fail with.
 */
export async function probeStorage(): Promise<{ buckets: number }> {
  const { data, error } = await supabase().storage.listBuckets();
  if (error) throw new Error(error.message);
  return { buckets: data.length };
}

