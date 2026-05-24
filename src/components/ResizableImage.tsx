"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useRef, useState } from "react";

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

function AlignIcon({ type }: { type: "left" | "center" | "right" }) {
  const w = 12;
  const lines = [
    { y: 0, lw: w },
    { y: 3.5, lw: 7 },
    { y: 7, lw: 10 },
  ];
  return (
    <svg width={w} height="10" viewBox={`0 0 ${w} 10`} fill="currentColor">
      {lines.map((l, i) => {
        const x =
          type === "center"
            ? (w - l.lw) / 2
            : type === "right"
              ? w - l.lw
              : 0;
        return <rect key={i} x={x} y={l.y} width={l.lw} height="1.5" rx=".5" />;
      })}
    </svg>
  );
}

function ResizableImageComponent(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);

  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || "";
  const title = (node.attrs.title as string) || undefined;
  const width = node.attrs.width as number | null;
  const align = (node.attrs.align as string) || "center";

  const startResize = useCallback(
    (e: React.MouseEvent, handle: Handle) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = imgRef.current?.offsetWidth || 300;
      const startHeight = imgRef.current?.offsetHeight || 200;
      const aspectRatio = startWidth / startHeight;

      const isEdge = handle.length === 1; // "n", "s", "e", "w"
      const isHorizontal = handle === "e" || handle === "w";

      // x 방향 부호: 오른쪽 핸들이면 +1, 왼쪽이면 -1
      const signX = handle.includes("e") ? 1 : -1;
      // y 방향 부호: 아래쪽 핸들이면 +1, 위쪽이면 -1
      const signY = handle.includes("s") ? 1 : -1;

      const calcNewWidth = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) * signX;
        const dy = (ev.clientY - startY) * signY;

        let delta: number;
        if (isEdge) {
          // 변 중간 핸들: 해당 축 방향만 사용하되 비율 유지
          delta = isHorizontal ? dx : dy * aspectRatio;
        } else {
          // 모서리 핸들: 더 큰 변화량 기준으로 비율 유지
          delta = Math.abs(dx) > Math.abs(dy) ? dx : dy * aspectRatio;
        }
        return Math.max(80, startWidth + delta);
      };

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = calcNewWidth(ev);
        if (imgRef.current) {
          imgRef.current.style.width = `${newWidth}px`;
        }
      };

      const onMouseUp = (ev: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        setResizing(false);
        updateAttributes({ width: Math.round(calcNewWidth(ev)) });
      };

      setResizing(true);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateAttributes]
  );

  const handles: Handle[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];

  return (
    <NodeViewWrapper
      className={`resizable-image-wrapper resizable-image-align-${align} ${selected ? "selected" : ""} ${resizing ? "resizing" : ""}`}
    >
      {selected && !resizing && (
        <div className="resizable-image-align-toolbar">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`resizable-image-align-btn ${align === a ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                updateAttributes({ align: a });
              }}
              title={a === "left" ? "왼쪽 정렬" : a === "center" ? "가운데 정렬" : "오른쪽 정렬"}
            >
              <AlignIcon type={a} />
            </button>
          ))}
        </div>
      )}
      <div
        className="resizable-image-container"
        style={{ width: width ? `${width}px` : undefined }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          title={title}
          style={{ width: width ? `${width}px` : undefined }}
          draggable={false}
        />
        {(selected || resizing) &&
          handles.map((h) => (
            <div
              key={h}
              className={`resizable-image-handle resizable-image-handle-${h}`}
              onMouseDown={(e) => startResize(e, h)}
            />
          ))}
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        width?: number;
        align?: string;
      }) => ReturnType;
    };
  }
}

export const ResizableImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      align: {
        default: "center",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-align") || "center",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-align": attributes.align,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    const styles: string[] = [];
    if (attrs.width) {
      styles.push(`width: ${attrs.width}px`);
    }
    const align = attrs["data-align"] || "center";
    styles.push("display: block");
    if (align === "center") {
      styles.push("margin-left: auto", "margin-right: auto");
    } else if (align === "right") {
      styles.push("margin-left: auto");
    }
    if (styles.length) attrs.style = styles.join("; ");
    return ["img", mergeAttributes(attrs)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },

  addCommands() {
    return {
      setImage:
        (options: {
          src: string;
          alt?: string;
          title?: string;
          width?: number;
          align?: string;
        }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    } satisfies Partial<import("@tiptap/core").RawCommands>;
  },
});
