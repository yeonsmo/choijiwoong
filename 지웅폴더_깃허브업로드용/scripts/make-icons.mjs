/**
 * 아이콘 생성 스크립트.
 *   - 원본 SVG(내부에 2880x2880 PNG 임베드)를 읽어 PNG 를 추출하고,
 *     파비콘/PWA 아이콘 크기들로 변환한다.
 *   - 실행: node scripts/make-icons.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG = join(root, "보험법령검증허브_아이콘 예정.svg");

async function main() {
  const svg = await readFile(SVG, "utf8");
  const m = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error("SVG 안에서 PNG base64 를 찾지 못했습니다.");
  const src = Buffer.from(m[1], "base64");

  const meta = await sharp(src).metadata();
  console.log(`원본 추출: ${meta.width}x${meta.height}`);

  // 배경색 샘플(좌상단 픽셀) — maskable 여백 색으로 사용.
  const { data } = await sharp(src)
    .resize(1, 1, { fit: "cover", position: "left top" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bg = { r: data[0], g: data[1], b: data[2], alpha: 1 };
  const bgHex = `#${[bg.r, bg.g, bg.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  console.log(`배경색 추정: ${bgHex}`);

  const iconsDir = join(root, "public", "icons");
  const appDir = join(root, "app");
  await mkdir(iconsDir, { recursive: true });

  const png = (size) => sharp(src).resize(size, size, { fit: "contain", background: bg });

  await png(192).png().toFile(join(iconsDir, "icon-192.png"));
  await png(512).png().toFile(join(iconsDir, "icon-512.png"));
  await png(180).png().toFile(join(iconsDir, "icon-180.png"));

  // maskable: 안전영역(중앙 80%)에 로고를 두고 나머지는 배경색으로 채움.
  const inner = Math.round(512 * 0.8);
  const logo = await sharp(src).resize(inner, inner, { fit: "contain", background: bg }).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(join(iconsDir, "icon-512-maskable.png"));

  // Next.js App Router 자동 인식용 파비콘(SVG 가 8MB 라 PNG 로 대체).
  await png(512).png().toFile(join(appDir, "icon.png"));

  // 구형 브라우저 호환용 favicon.ico (32x32, PNG 임베드 ICO).
  const fav = await sharp(src).resize(32, 32, { fit: "contain", background: bg }).png().toBuffer();
  await writeFile(join(appDir, "favicon.ico"), buildIco(fav, 32));

  // 결과 + 배경색을 파일로 남겨 후속(manifest) 단계에서 참조.
  await writeFile(join(root, "scripts", "icon-bg.json"), JSON.stringify({ bgHex }, null, 2));
  console.log("아이콘 생성 완료: public/icons/, app/icon.png");
}

/** 32x32 PNG 버퍼를 ICO 컨테이너로 감싼다(PNG-in-ICO 형식). */
function buildIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size % 256, 0); // width (256 -> 0)
  entry.writeUInt8(size % 256, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image size
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, pngBuffer]);
}

main().catch((e) => {
  console.error("아이콘 생성 실패:", e?.message || e);
  process.exit(1);
});
