"use client";

import { useState, useCallback, useRef, type DragEvent } from "react";
import { adminFetch } from "../utils/admin-fetch";
import {
  resizeImageIfNeeded,
  validateImageSize,
} from "../utils/image-resize";
import { resolveRouteConfig } from "../config";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

interface ImageVariantUrls {
  lg?: string;
  md?: string;
  sm?: string;
  thumb?: string;
}

interface UploadResult {
  url: string;
  key: string;
  size: number;
  variants?: ImageVariantUrls;
  variantKeys?: string[];
}

interface UseImageDropZoneOptions {
  multiple?: boolean;
  maxFiles?: number;
  onUpload: (result: UploadResult) => void;
  onKeyTracked?: (key: string) => void;
  disabled?: boolean;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    const allowed = ALLOWED_TYPES.map((t) => t.split("/")[1]).join(", ");
    return `지원하지 않는 파일 형식입니다. (허용: ${allowed})`;
  }
  const sizeError = validateImageSize(file);
  if (sizeError) return sizeError;
  return null;
}

async function uploadSingleFile(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  // upload 엔드포인트는 §5 config boundary 에서 해석된다 (consumer override
  // 가능; 미설정 시 레거시 기본 경로 — spec.md §4.1 C2 / B5).
  const { uploadEndpoint } = resolveRouteConfig();
  const res = await adminFetch(uploadEndpoint, {
    method: "POST",
    body: fd,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "업로드 실패");
  }
  return json.data;
}

export function useImageDropZone(options: UseImageDropZoneOptions) {
  const {
    multiple = false,
    maxFiles,
    onUpload,
    onKeyTracked,
    disabled = false,
  } = options;

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (disabled || files.length === 0) return;

      let toProcess = multiple ? files : [files[0]];

      if (maxFiles && toProcess.length > maxFiles) {
        toProcess = toProcess.slice(0, maxFiles);
        setError(`최대 ${maxFiles}개까지 업로드할 수 있습니다.`);
      }

      for (const file of toProcess) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      setError(null);

      setIsResizing(true);
      let resizedFiles: File[];
      try {
        resizedFiles = [];
        for (const file of toProcess) {
          const result = await resizeImageIfNeeded(file);
          if (result.wasResized && process.env.NODE_ENV === "development") {
            console.log(
              `[image-optimize] ${(result.originalSize / 1024 / 1024).toFixed(1)}MB → ${(result.newSize / 1024 / 1024).toFixed(1)}MB`
            );
          }
          if (result.file.size > MAX_UPLOAD_SIZE) {
            setError(
              `이미지 최적화 후에도 5MB를 초과합니다. (${(result.file.size / 1024 / 1024).toFixed(1)}MB) 더 작은 이미지를 사용해 주세요.`
            );
            setIsResizing(false);
            return;
          }
          resizedFiles.push(result.file);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "이미지 최적화 중 오류 발생";
        setError(msg);
        setIsResizing(false);
        return;
      }
      setIsResizing(false);

      setIsUploading(true);
      try {
        for (const file of resizedFiles) {
          const result = await uploadSingleFile(file);
          onUpload(result);
          if (result.key) onKeyTracked?.(result.key);
          if (result.variantKeys) {
            for (const vk of result.variantKeys) onKeyTracked?.(vk);
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "업로드 중 오류 발생";
        setError(msg);
      } finally {
        setIsUploading(false);
      }
    },
    [multiple, maxFiles, onUpload, onKeyTracked, disabled]
  );

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
        f.type.startsWith("image/")
      );

      if (files.length === 0) {
        setError("이미지 파일만 업로드할 수 있습니다.");
        return;
      }

      processFiles(files);
    },
    [processFiles, disabled]
  );

  const handleFileInput = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList || []);
      if (files.length > 0) {
        await processFiles(files);
      }
    },
    [processFiles]
  );

  return {
    isDragOver,
    isUploading,
    isResizing,
    error,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
    handleFileInput,
  };
}
