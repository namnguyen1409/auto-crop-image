import { useRef } from "react";
import type { Detection } from "@mediapipe/tasks-vision";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.src = src;
  });

export default function useCrop() {
  // internal offscreen canvases
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!previewCanvasRef.current)
    previewCanvasRef.current = document.createElement("canvas");
  if (!cropCanvasRef.current)
    cropCanvasRef.current = document.createElement("canvas");

  const generatePreview = async (
    item: { url: string },
    detector?: any,
    ratio = "1:1"
  ) => {
    const image = await loadImage(item.url);
    const canvas = previewCanvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const iw = image.width;
    const ih = image.height;
    canvas.width = iw;
    canvas.height = ih;
    ctx.clearRect(0, 0, iw, ih);
    ctx.drawImage(image, 0, 0);

    let faceBox: Detection["boundingBox"] | null = null;
    if (detector) {
      console.log("Detecting face for preview...");
      try {
        const result = await detector.detect(image);
        if (result?.detections?.length > 0)
          faceBox = result.detections[0].boundingBox;
      } catch (err) {
        console.warn("Face detect error", err);
      }
    } else {
      console.log("No detector provided, skipping face detection.");
    }

    // crop frame
    const [rw, rh] = ratio.split(":").map(Number);
    const aspect = rw / rh;

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

    if ((item as any).customCrop) {
      const c = (item as any).customCrop;
      cropX = c.x;
      cropY = c.y;
      cropW = c.width;
      cropH = c.height;
    } else if (faceBox) {
      const cx = faceBox.originX + faceBox.width / 2;
      const cy = faceBox.originY + faceBox.height / 2;
      cropX = Math.max(0, Math.min(iw - cropW, cx - cropW / 2));
      cropY = Math.max(0, Math.min(ih - cropH, cy - cropH / 2));
    }

    ctx.strokeStyle = "rgba(255,0,0,0.9)";
    ctx.lineWidth = 4;
    ctx.strokeRect(cropX, cropY, cropW, cropH);
    console.log(
      `faceBox: ${JSON.stringify(
        faceBox
      )}, crop: x=${cropX}, y=${cropY}, w=${cropW}, h=${cropH}`
    );
    // Draw face box if exists
    if (faceBox) {
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        faceBox.originX,
        faceBox.originY,
        faceBox.width,
        faceBox.height
      );
    }

    return { preview: canvas.toDataURL("image/png"), faceBox } as const;
  };

  const cropWithFace = async (
    src: string,
    faceBox: Detection["boundingBox"] | null,
    ratioStr: string,
    customCrop?: { x: number; y: number; width: number; height: number } | null
  ): Promise<string> => {
    const image = await loadImage(src);
    const canvas = cropCanvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const [rw, rh] = ratioStr.split(":").map(Number);
    const aspect = rw / rh;

    const iw = image.width;
    const ih = image.height;

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

    if (customCrop) {
      cropX = customCrop.x;
      cropY = customCrop.y;
      cropW = customCrop.width;
      cropH = customCrop.height;
    } else if (faceBox) {
      const cx = faceBox.originX + faceBox.width / 2;
      const cy = faceBox.originY + faceBox.height / 2;
      cropX = Math.max(0, Math.min(iw - cropW, cx - cropW / 2));
      cropY = Math.max(0, Math.min(ih - cropH, cy - cropH / 2));
    }

    canvas.width = cropW;
    canvas.height = cropH;
    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return canvas.toDataURL("image/jpeg", 0.95);
  };

  return { generatePreview, cropWithFace } as const;
}
