import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Detection } from "@mediapipe/tasks-vision";

export type ImageItem = {
  id: string;
  file: File;
  url: string;
  output?: string | null;
  preview?: string | null;
  faceBox?: Detection["boundingBox"] | null;
  customCrop?: { x: number; y: number; width: number; height: number } | null;
  loading?: boolean;
};

interface Props {
  item: ImageItem;
  ratio: string;
  onSave: (crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onClose: () => void;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.src = src;
  });

export default function EditCropModal({ item, ratio, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rect, setRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeHandleRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const img = await loadImage(item.url);
      if (!mounted) return;
      setImage(img);

      // compute initial crop
      const [rw, rh] = ratio.split(":").map(Number);
      const aspect = rw / rh;
      const iw = img.width;
      const ih = img.height;
      let cropW: number, cropH: number;
      if (iw / ih > aspect) {
        cropH = ih;
        cropW = ih * aspect;
      } else {
        cropW = iw;
        cropH = iw / aspect;
      }
      let cropX = (iw - cropW) / 2;
      let cropY = (ih - cropH) / 2;
      if (item.customCrop) {
        cropX = item.customCrop.x;
        cropY = item.customCrop.y;
        cropW = item.customCrop.width;
        cropH = item.customCrop.height;
      } else if (item.faceBox) {
        const cx = item.faceBox.originX + item.faceBox.width / 2;
        const cy = item.faceBox.originY + item.faceBox.height / 2;
        cropX = Math.max(0, Math.min(iw - cropW, cx - cropW / 2));
        cropY = Math.max(0, Math.min(ih - cropH, cy - cropH / 2));
      }
      setRect({ x: cropX, y: cropY, w: cropW, h: cropH });
    })();
    return () => {
      mounted = false;
    };
  }, [item, ratio]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = image;
    const r = rect;
    if (!canvas || !img || !r) return;
    const ctx = canvas.getContext("2d")!;

    const maxDim = 800;
    let scale = 1;
    if (img.width > maxDim || img.height > maxDim) {
      scale = Math.min(maxDim / img.width, maxDim / img.height);
    }
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sx = r.x * scale;
    const sy = r.y * scale;
    const sw = r.w * scale;
    const sh = r.h * scale;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, sx, sy, sw, sh);

    ctx.strokeStyle = "lime";
    ctx.lineWidth = 3;
    ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);

    const handleSize = Math.max(8, Math.round(Math.min(sw, sh) * 0.06));
    const handles = [
      { x: sx, y: sy, name: "nw" },
      { x: sx + sw, y: sy, name: "ne" },
      { x: sx, y: sy + sh, name: "sw" },
      { x: sx + sw, y: sy + sh, name: "se" },
    ];
    ctx.fillStyle = "white";
    handles.forEach((h) =>
      ctx.fillRect(
        h.x - handleSize / 2,
        h.y - handleSize / 2,
        handleSize,
        handleSize
      )
    );
  };

  useEffect(() => {
    draw();
  }, [image, rect]);

  const getPos = (e: MouseEvent) => {
    const canvas = canvasRef.current!;
    const rectBox = canvas.getBoundingClientRect();
    const x = (e.clientX - rectBox.left) * (canvas.width / rectBox.width);
    const y = (e.clientY - rectBox.top) * (canvas.height / rectBox.height);
    return { x, y };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const onDown = (ev: MouseEvent) => {
      if (!rect) return;
      const { x, y } = getPos(ev);
      const scale = canvas.width / image.width;
      const sx = rect.x * scale;
      const sy = rect.y * scale;
      const sw = rect.w * scale;
      const sh = rect.h * scale;
      const handleSize = Math.max(8, Math.round(Math.min(sw, sh) * 0.06));
      const overHandle = (hx: number, hy: number) =>
        Math.abs(x - hx) <= handleSize && Math.abs(y - hy) <= handleSize;
      if (overHandle(sx, sy)) {
        resizingRef.current = true;
        resizeHandleRef.current = "nw";
      } else if (overHandle(sx + sw, sy)) {
        resizingRef.current = true;
        resizeHandleRef.current = "ne";
      } else if (overHandle(sx, sy + sh)) {
        resizingRef.current = true;
        resizeHandleRef.current = "sw";
      } else if (overHandle(sx + sw, sy + sh)) {
        resizingRef.current = true;
        resizeHandleRef.current = "se";
      } else if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        draggingRef.current = true;
      }
      dragStartRef.current = { x, y };
    };
    const onMove = (ev: MouseEvent) => {
      if (!rect || !image || !dragStartRef.current) return;
      const { x, y } = getPos(ev);
      const canvasScale = canvas.width / image.width;
      const dx = (x - dragStartRef.current.x) / canvasScale;
      const dy = (y - dragStartRef.current.y) / canvasScale;
      const [rw, rh] = ratio.split(":").map(Number);
      const aspect = rw / rh;

      if (draggingRef.current) {
        let nx = rect.x + dx;
        let ny = rect.y + dy;
        nx = Math.max(0, Math.min(image.width - rect.w, nx));
        ny = Math.max(0, Math.min(image.height - rect.h, ny));
        setRect((r) => (r ? { ...r, x: nx, y: ny } : r));
        dragStartRef.current = { x, y };
      } else if (resizingRef.current) {
        const handle = resizeHandleRef.current;
        if (!handle) return;
        let { x: cx, y: cy, w: cw, h: ch } = rect;
        if (handle === "se") {
          let newW = Math.max(30, cw + dx);
          let newH = newW / aspect;
          if (cy + newH > image.height) {
            newH = image.height - cy;
            newW = newH * aspect;
          }
          if (cx + newW > image.width) {
            newW = image.width - cx;
            newH = newW / aspect;
          }
          setRect({ x: cx, y: cy, w: newW, h: newH });
        } else if (handle === "nw") {
          let newW = Math.max(30, cw - dx);
          let newH = newW / aspect;
          let newX = cx + (cw - newW);
          let newY = cy + (ch - newH);
          if (newX < 0) {
            newX = 0;
            newW = cx + cw;
            newH = newW / aspect;
            newY = cy + ch - newH;
          }
          if (newY < 0) {
            newY = 0;
            newH = cy + ch;
            newW = newH * aspect;
            newX = cx + cw - newW;
          }
          setRect({ x: newX, y: newY, w: newW, h: newH });
        } else if (handle === "ne") {
          let newW = Math.max(30, cw + dx);
          let newH = newW / aspect;
          let newY = cy + (ch - newH);
          if (cx + newW > image.width) {
            newW = image.width - cx;
            newH = newW / aspect;
            newY = cy + ch - newH;
          }
          if (newY < 0) {
            newY = 0;
            newH = cy + ch;
            newW = newH * aspect;
          }
          setRect({ x: cx, y: newY, w: newW, h: newH });
        } else if (handle === "sw") {
          let newW = Math.max(30, cw - dx);
          let newH = newW / aspect;
          let newX = cx + (cw - newW);
          if (newX < 0) {
            newX = 0;
            newW = cx + cw;
            newH = newW / aspect;
          }
          if (cy + newH > image.height) {
            newH = image.height - cy;
            newW = newH * aspect;
            newX = cx + cw - newW;
          }
          setRect({ x: newX, y: cy, w: newW, h: newH });
        }
        dragStartRef.current = { x, y };
      }
    };
    const onUp = () => {
      draggingRef.current = false;
      resizingRef.current = false;
      resizeHandleRef.current = null;
      dragStartRef.current = null;
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rect, image, ratio]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-md p-4 max-w-[90vw] max-h-[90vh] overflow-auto">
        <div className="mb-2 flex justify-between items-center">
          <div className="font-medium">Chỉnh sửa crop (tỉ lệ {ratio})</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                rect &&
                onSave({ x: rect.x, y: rect.y, width: rect.w, height: rect.h })
              }
            >
              Lưu
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
          </div>
        </div>
        <div>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: "100%",
              height: "auto",
              display: "block",
              backgroundColor: "rgba(0,0,0,0)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
