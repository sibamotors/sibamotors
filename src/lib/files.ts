import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { authMiddleware } from "./session-middleware";
import { nid } from "./utils";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type StoredFileMeta = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
};

/**
 * Only these types are served with their real MIME type. Anything else (html,
 * svg, scripts …) is stored and served as a plain download, so an uploaded file
 * can never run code inside the app.
 */
const SAFE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/json",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function safeMime(mime: string): string {
  const m = mime.trim().toLowerCase().split(";")[0] ?? "";
  return SAFE_MIME.has(m) ? m : "application/octet-stream";
}

/** Real size of a base64 string in bytes. */
function base64Bytes(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Store a file in the app_files table. The uploader is always the logged-in user. */
export const uploadAppFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      filename: string;
      mime: string;
      sizeBytes: number;
      dataBase64: string;
      uploadedBy?: string; // ignored — the server uses the session
    }) => data,
  )
  .handler(async ({ data, context }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    const b64 = typeof data.dataBase64 === "string" ? data.dataBase64 : "";
    if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
      return { ok: false, error: "داده فایل نامعتبر است." };
    }
    // measure the REAL size (never trust the size the browser claims)
    const realBytes = base64Bytes(b64);
    if (realBytes > MAX_FILE_BYTES) {
      return { ok: false, error: "حجم فایل بیشتر از ۵ مگابایت است." };
    }
    const filename = String(data.filename ?? "file")
      .replace(/[\\/\u0000-\u001f]/g, "_")
      .slice(0, 200) || "file";
    const sql = await getSql();
    const id = nid();
    const now = new Date().toISOString();
    await sql`
      insert into app_files (id, filename, mime, size_bytes, data, uploaded_by, created_at)
      values (${id}, ${filename}, ${safeMime(String(data.mime ?? ""))}, ${realBytes}, ${b64}, ${context.user.username}, ${now})
    `;
    return { ok: true as const, id };
  });

/**
 * Download a file. Allowed only for: the uploader, or someone who can see a
 * message / group message / work report that contains this file.
 */
export const getAppFile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { ok: true; filename: string; mime: string; sizeBytes: number; dataBase64: string }
      | { ok: false; error: string }
    > => {
      const me = context.user.username;
      const id = String(data.id ?? "").slice(0, 100);
      const sql = await getSql();
      const rows = await sql<{
        filename: string;
        mime: string;
        size_bytes: number;
        data: string;
      }>`
        select f.filename, f.mime, f.size_bytes, f.data
        from app_files f
        where f.id = ${id}
          and (
            f.uploaded_by = ${me}
            or exists (
              select 1 from app_messages m
              where (m.from_username = ${me} or m.to_username = ${me})
                and m.deleted_at is null and position(${id} in m.body) > 0
            )
            or exists (
              select 1 from app_group_messages gm
              join app_group_members mem on mem.group_id = gm.group_id and mem.username = ${me}
              where gm.deleted_at is null and position(${id} in gm.body) > 0
            )
            or exists (
              select 1 from app_work_reports r
              where r.file_id = ${id} and (r.to_username = ${me} or r.from_username = ${me})
            )
          )
      `;
      const r = rows[0];
      if (!r) return { ok: false, error: "فایل پیدا نشد." };
      return {
        ok: true as const,
        filename: r.filename,
        mime: safeMime(r.mime),
        sizeBytes: r.size_bytes,
        dataBase64: r.data,
      };
    },
  );
