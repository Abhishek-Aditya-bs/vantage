/**
 * Media blob storage — a tiny pluggable abstraction so the *bytes* of a photo can
 * live in either the space's Durable Object SQLite (free, default) or in R2
 * (Phase-2 upgrade), without the rest of the DO caring which. Metadata always
 * stays in the DO's `media` table; only the raw bytes move.
 *
 *   STORAGE_MODE=do  → DoSqliteBlobStore  (media_blobs table; per-value ≤ 2 MB)
 *   STORAGE_MODE=r2  → R2BlobStore        (one object per media id, prefixed by space)
 */
import type { AppEnv } from "./env";
import { storageMode } from "./env";

export interface StoredBlob {
  body: ArrayBuffer;
  contentType: string;
}

export interface MediaBlobStore {
  readonly backend: "do" | "r2";
  put(id: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(id: string): Promise<StoredBlob | null>;
  delete(ids: string[]): Promise<void>;
}

/** Default, free-tier store: bytes in the DO's own SQLite (a dedicated table). */
export class DoSqliteBlobStore implements MediaBlobStore {
  readonly backend = "do" as const;
  constructor(private readonly sql: SqlStorage) {}

  async put(id: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.sql.exec(
      `INSERT INTO media_blobs (id, content_type, bytes) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET content_type = excluded.content_type, bytes = excluded.bytes`,
      id,
      contentType,
      bytes,
    );
  }

  async get(id: string): Promise<StoredBlob | null> {
    const row = this.sql
      .exec<{ bytes: ArrayBuffer; content_type: string }>(
        `SELECT bytes, content_type FROM media_blobs WHERE id = ?`,
        id,
      )
      .toArray()[0];
    return row ? { body: row.bytes, contentType: row.content_type } : null;
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) this.sql.exec(`DELETE FROM media_blobs WHERE id = ?`, id);
  }
}

/** Phase-2 store: bytes in an R2 bucket, one object per media id (prefixed by space). */
export class R2BlobStore implements MediaBlobStore {
  readonly backend = "r2" as const;
  constructor(
    private readonly bucket: R2Bucket,
    private readonly prefix: string,
  ) {}

  private key(id: string): string {
    return `${this.prefix}/${id}`;
  }

  async put(id: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.bucket.put(this.key(id), bytes, { httpMetadata: { contentType } });
  }

  async get(id: string): Promise<StoredBlob | null> {
    const obj = await this.bucket.get(this.key(id));
    if (!obj) return null;
    return {
      body: await obj.arrayBuffer(),
      contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length) await this.bucket.delete(ids.map((i) => this.key(i)));
  }
}

/**
 * Select a store for this space. Falls back to DO SQLite whenever R2 isn't both
 * requested (`STORAGE_MODE=r2`) AND bound (`MEDIA_BUCKET`), so a half-configured
 * deploy degrades safely to the free path instead of erroring.
 */
export function createMediaStore(
  env: AppEnv,
  sql: SqlStorage,
  spacePrefix: string,
): MediaBlobStore {
  if (storageMode(env) === "r2" && env.MEDIA_BUCKET) {
    return new R2BlobStore(env.MEDIA_BUCKET, `spaces/${spacePrefix}`);
  }
  return new DoSqliteBlobStore(sql);
}
