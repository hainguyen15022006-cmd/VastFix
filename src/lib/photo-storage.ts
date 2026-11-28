import "server-only";
import { constants } from "node:fs";
import { mkdir, open, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import sharp from "sharp";
import { ApiError } from "./api";

export const maxPhotoBytes = 5 * 1024 * 1024;
export const maxUploadBodyBytes = maxPhotoBytes + 64 * 1024;
const imageTypes = { jpeg: { mime: "image/jpeg", ext: "jpg" }, png: { mime: "image/png", ext: "png" }, webp: { mime: "image/webp", ext: "webp" } } as const;

export function photoPath(storageKey: string) {
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}\.(jpg|png|webp)$/.test(storageKey)) {
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
  }
  // Uploaded files are runtime data in a private volume, never build inputs.
  const root = resolve(/*turbopackIgnore: true*/ process.env.VASTFIX_UPLOAD_DIR || "data/private/photos");
  const publicDir = resolve("public");
  if (root === publicDir || root.startsWith(publicDir + sep)) {
    throw new ApiError(503, "PHOTO_STORAGE_UNAVAILABLE", "Nơi lưu ảnh chưa được cấu hình đúng");
  }
  return { root, path: resolve(root, storageKey) };
}

export async function normalizePhoto(input: Buffer, declaredType: string) {
  if (!input.length || input.length > maxPhotoBytes) {
    throw new ApiError(input.length ? 413 : 400, "INVALID_PHOTO_SIZE", "Ảnh phải có dữ liệu và không vượt quá 5 MB");
  }
  const signature = input.subarray(0, 12);
  const format = signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
    : signature.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpeg"
      : signature.toString("ascii", 0, 4) === "RIFF" && signature.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;
  if (!format || imageTypes[format].mime !== declaredType) {
    throw new ApiError(415, "UNSUPPORTED_PHOTO", "Chỉ nhận ảnh JPEG, PNG hoặc WebP đúng định dạng");
  }
  let bytes: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 24_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) !== 1) throw new Error("Unsupported image");
    // Re-encode before a Report exists: reject corrupt images and remove metadata.
    bytes = await image.rotate().toFormat(format).toBuffer();
  } catch {
    throw new ApiError(415, "UNSUPPORTED_PHOTO", "Ảnh bị hỏng hoặc có kích thước không được hỗ trợ");
  }
  if (bytes.length > maxPhotoBytes) throw new ApiError(413, "INVALID_PHOTO_SIZE", "Ảnh sau xử lý vượt quá 5 MB");
  return { bytes, ...imageTypes[format] };
}

export async function writePhoto(storageKey: string, bytes: Buffer) {
  const { root, path } = photoPath(storageKey);
  let file;
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    file = await open(/*turbopackIgnore: true*/ path, "wx", 0o600);
    await file.writeFile(bytes);
  } catch {
    if (file) {
      await file.close(); file = undefined;
      await unlink(/*turbopackIgnore: true*/ path).catch(() => {});
    }
    throw new ApiError(503, "PHOTO_STORAGE_UNAVAILABLE", "Chưa lưu được ảnh, vui lòng thử lại");
  } finally {
    await file?.close();
  }
}

export async function removePhotoFile(storageKey: string) {
  const { path } = photoPath(storageKey);
  try { await unlink(/*turbopackIgnore: true*/ path); }
  catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      console.error("PHOTO_FILE_CLEANUP_FAILED");
    }
  }
}

export async function readPhotoFile(storageKey: string, sizeBytes: number) {
  const { path } = photoPath(storageKey);
  let file;
  try {
    file = await open(/*turbopackIgnore: true*/ path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size !== sizeBytes || stat.size > maxPhotoBytes) throw new Error("Invalid photo file");
    return await file.readFile();
  } catch {
    throw new ApiError(503, "PHOTO_STORAGE_UNAVAILABLE", "Tệp ảnh tạm không khả dụng");
  } finally { await file?.close(); }
}
