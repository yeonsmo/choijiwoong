import "server-only";

import { randomUUID } from "node:crypto";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/**
 * Supabase Storage 헬퍼(지침 1-5: 대용량 파일은 Storage 직접 업로드 후 URL/경로 전달).
 *   - 비공개 버킷 'media' 를 사용한다. 업로드는 서명 URL 로 클라이언트가 직접 수행한다.
 *   - 분석 시 서버가 service_role 로 다운로드하여 모델에 전달한다.
 */

export const MEDIA_BUCKET = "media";

/** 버킷이 없으면 생성한다(비공개). 멱등. */
export async function ensureMediaBucket(): Promise<void> {
  const admin = createServiceRoleSupabase();
  const { data } = await admin.storage.getBucket(MEDIA_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: "200MB",
  });
  // 이미 존재(동시성) 오류는 무시. 그 외는 전파.
  if (error && !/exists/i.test(error.message)) {
    throw new Error(`스토리지 버킷 생성 실패: ${error.message}`);
  }
}

export interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

/** 사용자별 경로에 업로드용 서명 URL 을 발급한다. */
export async function createSignedUpload(
  userId: string,
  filename: string,
): Promise<SignedUpload> {
  await ensureMediaBucket();
  const admin = createServiceRoleSupabase();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${userId}/${randomUUID()}-${safe}`;
  const { data, error } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`업로드 URL 발급 실패: ${error?.message ?? "unknown"}`);
  }
  return { path, token: data.token, signedUrl: data.signedUrl };
}

/** 저장된 파일을 base64 + MIME 으로 가져온다(분석 입력용). */
export async function downloadAsBase64(
  path: string,
): Promise<{ base64: string; mimeType: string }> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`파일 다운로드 실패: ${error?.message ?? "unknown"}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = data.type || "application/octet-stream";
  return { base64, mimeType };
}

/** 서버에서 생성한 바이트(생성 이미지 등)를 업로드하고 경로를 반환한다. */
export async function uploadBytes(
  userId: string,
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  await ensureMediaBucket();
  const admin = createServiceRoleSupabase();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${userId}/gen/${randomUUID()}-${safe}`;
  const { error } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`생성물 업로드 실패: ${error.message}`);
  return path;
}

/** 읽기용 서명 URL(생성 결과 다운로드 등). */
export async function createSignedReadUrl(
  path: string,
  expiresInSec = 3600,
): Promise<string> {
  const admin = createServiceRoleSupabase();
  const { data, error } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error || !data) {
    throw new Error(`읽기 URL 발급 실패: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
