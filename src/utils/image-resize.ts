const MAX_DIMENSION = 1920; // px
const TARGET_SIZE = 4 * 1024 * 1024; // 4MB
const SKIP_THRESHOLD = 500 * 1024; // 500KB
const GIF_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ABSOLUTE_MAX_SIZE = 50 * 1024 * 1024; // 50MB

const SKIP_RESIZE_TYPES = ["image/gif"];

export interface ResizeResult {
  file: File;
  wasResized: boolean;
  originalSize: number;
  newSize: number;
}

export async function resizeImageIfNeeded(
  file: File
): Promise<ResizeResult> {
  const originalSize = file.size;

  if (SKIP_RESIZE_TYPES.includes(file.type)) {
    return { file, wasResized: false, originalSize, newSize: originalSize };
  }

  const img = await loadImage(file);
  const { width, height } = img;
  const longestEdge = Math.max(width, height);

  if (file.size <= SKIP_THRESHOLD && longestEdge <= MAX_DIMENSION) {
    return { file, wasResized: false, originalSize, newSize: originalSize };
  }

  const outputMime = detectOutputMime(file.type);

  let targetW = width;
  let targetH = height;
  if (longestEdge > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longestEdge;
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  const qualitySteps = [0.85, 0.8, 0.75, 0.65, 0.55, 0.5];
  for (const quality of qualitySteps) {
    const blob = await canvasToBlob(img, targetW, targetH, outputMime, quality);
    if (blob.size <= TARGET_SIZE) {
      return toResult(blob, file.name, outputMime, originalSize);
    }
  }

  const scaleSteps = [0.8, 0.65, 0.5, 0.4];
  for (const scale of scaleSteps) {
    const newW = Math.round(targetW * scale);
    const newH = Math.round(targetH * scale);
    const blob = await canvasToBlob(img, newW, newH, outputMime, 0.75);
    if (blob.size <= TARGET_SIZE) {
      return toResult(blob, file.name, outputMime, originalSize);
    }
  }

  const finalW = Math.round(targetW * 0.3);
  const finalH = Math.round(targetH * 0.3);
  const finalBlob = await canvasToBlob(img, finalW, finalH, outputMime, 0.5);
  return toResult(finalBlob, file.name, outputMime, originalSize);
}

export function validateImageSize(file: File): string | null {
  if (file.size > ABSOLUTE_MAX_SIZE) {
    return `파일 크기가 너무 큽니다. (${(file.size / 1024 / 1024).toFixed(0)}MB, 최대 50MB)`;
  }
  if (SKIP_RESIZE_TYPES.includes(file.type) && file.size > GIF_MAX_SIZE) {
    return `GIF 파일은 5MB 이하만 업로드할 수 있습니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  return null;
}

function detectOutputMime(inputType: string): string {
  if (typeof document === "undefined") return "image/jpeg";
  const supportsWebP = document
    .createElement("canvas")
    .toDataURL("image/webp")
    .startsWith("data:image/webp");
  if (supportsWebP) return "image/webp";
  return inputType === "image/png" ? "image/jpeg" : inputType || "image/jpeg";
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 로드에 실패했습니다. 파일이 손상되었을 수 있습니다."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  mime: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("이미지 처리에 실패했습니다."));
      return;
    }
    if (mime !== "image/png") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("이미지 변환에 실패했습니다."));
      },
      mime,
      quality
    );
  });
}

function toResult(
  blob: Blob,
  originalName: string,
  mime: string,
  originalSize: number
): ResizeResult {
  const ext =
    mime === "image/jpeg" ? ".jpg" : mime === "image/webp" ? ".webp" : ".png";
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const file = new File([blob], `${baseName}${ext}`, { type: mime });
  return { file, wasResized: true, originalSize, newSize: blob.size };
}
