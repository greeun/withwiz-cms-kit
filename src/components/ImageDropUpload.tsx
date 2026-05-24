"use client";

import { useRef } from "react";
import { useImageDropZone } from "../hooks/useImageDropZone";
import "./image-drop-zone.css";

interface Props {
  /** Current image URL */
  src: string;
  /** Called with uploaded image URL and key */
  onUpload: (url: string, key: string) => void;
  /** Track uploaded key for orphan cleanup */
  onKeyTracked?: (key: string) => void;
  /** CSS class for the drop zone container */
  className?: string;
  /** Placeholder text when no image */
  placeholder?: string;
}

export default function ImageDropUpload({
  src,
  onUpload,
  onKeyTracked,
  className = "",
  placeholder = "클릭 또는 드래그하여 이미지 추가",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const drop = useImageDropZone({
    onUpload: (result) => onUpload(result.url, result.key),
    onKeyTracked,
  });

  const cls = [
    className,
    src ? "has" : "",
    drop.isDragOver ? "is-drag-over" : "",
    drop.isUploading ? "is-uploading" : "",
    drop.isResizing ? "is-resizing" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          await drop.handleFileInput(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        className={cls}
        onClick={() => !drop.isUploading && !drop.isResizing && inputRef.current?.click()}
        {...drop.dragHandlers}
      >
        {drop.isResizing ? (
          <span className="dz-upload-spinner">최적화 중...</span>
        ) : drop.isUploading ? (
          <span className="dz-upload-spinner">업로드 중...</span>
        ) : drop.isDragOver ? (
          <span className="dz-drag-hint">놓으세요</span>
        ) : src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt="" style={{ maxWidth: "100%", height: "auto" }} />
        ) : (
          <div className="dz-placeholder">
            <div className="dz-placeholder-icon">+</div>
            <div className="dz-placeholder-text">{placeholder}</div>
            <div className="dz-placeholder-guide">
              JPG, PNG, WebP, GIF | 최대 5MB
              <br />
              초과 시 자동 압축 · 1920px 이하로 리사이즈
              <br />
              WebP 변환 · 4개 사이즈(lg/md/sm/thumb) 자동 생성
            </div>
          </div>
        )}
      </div>
      {drop.error && <div className="dz-error">{drop.error}</div>}
    </>
  );
}
