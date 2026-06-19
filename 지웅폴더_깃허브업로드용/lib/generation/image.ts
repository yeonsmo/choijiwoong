import "server-only";

import { getActiveKeysPlain } from "@/lib/ai/keys";
import { DEFAULT_MODELS } from "@/lib/ai/models";
import { uploadBytes, createSignedReadUrl } from "@/lib/storage";

/**
 * 이미지 생성(지침 5-2-1): OpenAI DALL-E / Google Imagen / Stability AI.
 *   - 입력된 제공자 키로만 동작한다(키 없으면 오류).
 *   - 생성된 이미지는 Storage 에 업로드하고 서명 URL 을 반환한다.
 *   - 오류는 원문 전파(지침 9-4).
 */
export interface ImageResult {
  provider: string;
  assetUrl: string;
  path: string;
}

export async function generateImage(brief: string, userId: string): Promise<ImageResult> {
  const keys = await getActiveKeysPlain("image");
  if (keys.length === 0) {
    throw new Error("이미지 생성용 AI 키가 없습니다. 설정에서 이미지 키(DALL-E/Imagen/Stability)를 등록하세요.");
  }
  const key = keys[0];

  // 법령 준수를 전제로 한 안전한 프롬프트(텍스트 과장/허위 묘사 배제 안내).
  const prompt = `보험광고용 이미지. ${brief}. 사실에 근거하고 과장·오인 유발 요소를 배제한 깔끔하고 신뢰감 있는 구성. 텍스트 삽입 최소화.`;

  let bytes: Buffer;
  let contentType = "image/png";

  if (key.provider === "openai") {
    bytes = await openaiImage(key.apiKey, prompt);
  } else if (key.provider === "stability") {
    const r = await stabilityImage(key.apiKey, prompt);
    bytes = r.bytes;
    contentType = r.contentType;
  } else if (key.provider === "imagen") {
    bytes = await imagenImage(key.apiKey, prompt);
  } else {
    throw new Error(`지원하지 않는 이미지 제공자: ${key.provider}`);
  }

  const path = await uploadBytes(userId, "generated.png", bytes, contentType);
  const assetUrl = await createSignedReadUrl(path);
  return { provider: key.provider, assetUrl, path };
}

async function openaiImage(apiKey: string, prompt: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEFAULT_MODELS["openai-image"],
      prompt,
      size: "1024x1024",
      n: 1,
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI 이미지 HTTP ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as { data?: { b64_json?: string; url?: string }[] };
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return fetchBytes(item.url);
  throw new Error("OpenAI 이미지 응답에 데이터가 없습니다.");
}

async function stabilityImage(
  apiKey: string,
  prompt: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("output_format", "png");
  const res = await fetch(
    `https://api.stability.ai/v2beta/stable-image/generate/core`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, accept: "image/*" },
      body: form,
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Stability HTTP ${res.status}: ${t.slice(0, 400)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { bytes: buf, contentType: res.headers.get("content-type") || "image/png" };
}

async function imagenImage(apiKey: string, prompt: string): Promise<Buffer> {
  const model = DEFAULT_MODELS["google-imagen"];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Imagen HTTP ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as {
    predictions?: { bytesBase64Encoded?: string }[];
  };
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error("Imagen 응답에 이미지가 없습니다.");
  return Buffer.from(b64, "base64");
}

async function fetchBytes(url: string): Promise<Buffer> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`이미지 다운로드 실패 HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
