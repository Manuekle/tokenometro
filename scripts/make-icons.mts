/**
 * Builds every icon the app ships from brand/icon.png (the app icon, 1254x1254).
 * macOS only: it resizes with the built-in `sips`.
 *
 *   pnpm icons
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url));
const at = (path: string) => join(root, path);
const master = at("brand/icon.png");

/** Match the footer: preserve the master's padding and its 13px radius at 44px. */
const CORNER = 13 / 44;

const sips = (...args: string[]) => execFileSync("sips", args, { stdio: "ignore" });
const resize = (from: string, px: number, to: string) =>
  sips("-z", String(px), String(px), from, "--out", to);

/** The pixels of the 24-bit BMP that sips writes: `px` x `px`, RGB, top row first. */
function readBmp(bmp: Buffer): { px: number; rgb: Buffer } {
  const offset = bmp.readUInt32LE(10);
  const px = bmp.readInt32LE(18);
  const height = bmp.readInt32LE(22);
  const bits = bmp.readUInt16LE(28);
  if (bits !== 24 || px !== Math.abs(height)) {
    throw new Error(`Unexpected bitmap from sips: ${px}x${height} at ${bits} bits`);
  }
  const stride = Math.ceil((px * 24) / 32) * 4;
  const rgb = Buffer.alloc(px * px * 3);
  for (let y = 0; y < px; y++) {
    const row = offset + (height < 0 ? y : px - 1 - y) * stride; // BMP rows are bottom-up unless the height is negative
    for (let x = 0; x < px; x++) {
      const from = row + x * 3; // stored as B, G, R
      const to = (y * px + x) * 3;
      rgb[to] = bmp[from + 2];
      rgb[to + 1] = bmp[from + 1];
      rgb[to + 2] = bmp[from];
    }
  }
  return { px, rgb };
}

/**
 * The same pixels with a rounded square cut out of them: everything outside it is
 * transparent, and the edge is anti-aliased. sips writes no alpha channel, so the
 * corners have to be made here.
 */
function roundCorners({ px, rgb }: { px: number; rgb: Buffer }): Buffer {
  const half = px / 2;
  const radius = px * CORNER;
  const rgba = Buffer.alloc(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      // Signed distance from the pixel's centre to the rounded square's edge (negative inside).
      const qx = Math.abs(x + 0.5 - half) - (half - radius);
      const qy = Math.abs(y + 0.5 - half) - (half - radius);
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const from = (y * px + x) * 3;
      const to = (y * px + x) * 4;
      rgba[to] = rgb[from];
      rgba[to + 1] = rgb[from + 1];
      rgba[to + 2] = rgb[from + 2];
      rgba[to + 3] = Math.round(255 * Math.min(1, Math.max(0, 0.5 - distance)));
    }
  }
  return rgba;
}

/** A PNG with an alpha channel (8-bit RGBA), written by hand because sips cannot write one. */
function encodePng(px: number, rgba: Buffer): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(px, 0);
  header.writeUInt32BE(px, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // colour type: RGBA

  const rowBytes = px * 4;
  const rows = Buffer.alloc((rowBytes + 1) * px); // each row starts with its filter byte: 0, none
  for (let y = 0; y < px; y++) rgba.copy(rows, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An .ico file is a small directory followed by the images, which can be PNGs as they are. */
function ico(images: { px: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(({ px, png }, i) => {
    const entry = i * 16;
    directory.writeUInt8(px % 256, entry); // width (0 means 256)
    directory.writeUInt8(px % 256, entry + 1); // height
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.png)]);
}

const work = mkdtempSync(join(tmpdir(), "tokenometro-icons-"));
try {
  /** Tab icons keep the same framing as the footer instead of zooming into the mark. */
  const tab = (px: number) => {
    const file = join(work, `tab-${px}.bmp`);
    sips("-z", String(px), String(px), "-s", "format", "bmp", master, "--out", file);
    const pixels = readBmp(readFileSync(file));
    return encodePng(pixels.px, roundCorners(pixels));
  };

  // What the Next.js app directory picks up by file name.
  writeFileSync(at("src/app/icon.png"), tab(192));
  resize(master, 180, at("src/app/apple-icon.png")); // iOS rounds the corners itself: keep a full square
  writeFileSync(at("src/app/favicon.ico"), ico([16, 32, 48].map((px) => ({ px, png: tab(px) }))));

  // What the web manifest points to: full squares, the operating system masks them.
  mkdirSync(at("public/icons"), { recursive: true });
  resize(master, 192, at("public/icons/icon-192.png"));
  resize(master, 512, at("public/icons/icon-512.png"));

  console.log("icons written: src/app/{icon.png,apple-icon.png,favicon.ico}, public/icons/icon-{192,512}.png");
} finally {
  rmSync(work, { recursive: true, force: true });
}
