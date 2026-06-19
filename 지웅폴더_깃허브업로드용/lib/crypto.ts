import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { getServerEnv } from "@/lib/env";

/**
 * DB에 저장되는 비밀값(법제처 API 키, AI API 키 등)을 암호화/복호화한다.
 * 알고리즘: AES-256-GCM.
 * 마스터 키: APP_ENCRYPTION_KEY (base64 인코딩된 32바이트).
 *
 * 저장 포맷(문자열): base64(iv).base64(authTag).base64(ciphertext)
 * - 이 모듈은 server-only. 평문 키는 절대 클라이언트로 나가지 않는다.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM 권장 nonce 길이

function getKey(): Buffer {
  const { APP_ENCRYPTION_KEY } = getServerEnv();
  const key = Buffer.from(APP_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY 길이 오류: base64 디코딩 결과 ${key.length}바이트. ` +
        `정확히 32바이트여야 합니다. 생성: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptSecret(stored: string): string {
  const key = getKey();
  const parts = stored.split(".");
  if (parts.length !== 3) {
    throw new Error("암호화 저장 포맷 오류: iv.authTag.ciphertext 형식이 아닙니다.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** UI 표시용 마스킹: 끝 4자리만 노출. 평문 자체는 반환하지 않는다. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "****";
  return "****" + plaintext.slice(-4);
}
