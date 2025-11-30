import { useEffect, useRef, useState } from "react";
import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from "@mediapipe/tasks-vision";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";


interface ImageItem {
  id: string;
  file: File;
  url: string;
  output?: string | null;
  preview?: string | null;
  faceBox?: Detection["boundingBox"] | null;
  loading?: boolean;
}

export default function FaceCropPage() {
  const [detector, setDetector] = useState<FaceDetector | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [ratio, setRatio] = useState<string>("1:1");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Init mediapipe
  useEffect(() => {
    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      const faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        },
        runningMode: "IMAGE",
      });

      setDetector(faceDetector);
    };

    init();
  }, []);

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.src = src;
    });

  const updateImage = (id: string, patch: Partial<ImageItem>) => {
    setImages((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const generatePreview = async (item: ImageItem) => {
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
      try {
        const result = await detector.detect(image);
        if (result?.detections?.length > 0) faceBox = result.detections[0].boundingBox;
      } catch (err) {
        console.warn("Face detect error", err);
      }
    }

    if (faceBox) {
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 4;
      ctx.strokeRect(faceBox.originX, faceBox.originY, faceBox.width, faceBox.height);
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

    if (faceBox) {
      const cx = faceBox.originX + faceBox.width / 2;
      const cy = faceBox.originY + faceBox.height / 2;
      cropX = Math.max(0, Math.min(iw - cropW, cx - cropW / 2));
      cropY = Math.max(0, Math.min(ih - cropH, cy - cropH / 2));
    }

    ctx.strokeStyle = "rgba(255,0,0,0.9)";
    ctx.lineWidth = 4;
    ctx.strokeRect(cropX, cropY, cropW, cropH);

    return { preview: canvas.toDataURL("image/png"), faceBox } as const;
  };

  const generatePreviewAndUpdate = async (item: ImageItem) => {
    updateImage(item.id, { loading: true });
    try {
      const { preview, faceBox } = await generatePreview(item);
      updateImage(item.id, { preview, faceBox, loading: false });
    } catch (err) {
      console.error("preview error", err);
      updateImage(item.id, { loading: false });
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    const list = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: f,
      url: URL.createObjectURL(f),
      output: null,
      preview: null,
      faceBox: null,
      loading: true,
    }));

    setImages((prev) => {
      const merged = [...prev, ...list];
      list.forEach((it) => void generatePreviewAndUpdate(it));
      return merged;
    });

    if (e.target) e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    const list = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: f,
      url: URL.createObjectURL(f),
      output: null,
      preview: null,
      faceBox: null,
      loading: true,
    }));

    setImages((prev) => {
      const merged = [...prev, ...list];
      list.forEach((it) => void generatePreviewAndUpdate(it));
      return merged;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  useEffect(() => {
    if (!images.length) return;
    // regenerate previews when ratio changes
    void Promise.all(images.map((it) => generatePreviewAndUpdate(it)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  const generateAllPreview = async () => {
    await Promise.all(images.map((it) => generatePreviewAndUpdate(it)));
  };

  const cropWithFace = async (
    src: string,
    faceBox: Detection["boundingBox"] | null,
    ratioStr: string
  ): Promise<string> => {
    const image = await loadImage(src);
    const canvas = canvasRef.current!;
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

    if (faceBox) {
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

  const cropAll = async () => {
    for (const img of images) {
      updateImage(img.id, { loading: true });
      try {
        const out = await cropWithFace(img.url, img.faceBox ?? null, ratio);
        updateImage(img.id, { output: out, loading: false });
      } catch (err) {
        console.error("crop error", err);
        updateImage(img.id, { loading: false });
      }
    }
  };

  const downloadOne = async (img: ImageItem) => {
    if (!img.output) {
      // create output first
      const out = await cropWithFace(img.url, img.faceBox ?? null, ratio);
      img.output = out;

    };
    const a = document.createElement("a");
    a.href = img.output;
    a.download = img.file.name.replace(/\.[^.]+$/, "_cropped.jpg");
    a.click();
  };

  const downloadAll = async () => {
    const needCrop = images.some((it) => !it.output);
    if (needCrop) await cropAll();
    for (const img of images) {
      const a = document.createElement("a");
      a.href = img.output!;
      a.download = img.file.name.replace(/\.[^.]+$/, "_cropped.jpg");
      a.click();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Auto Face Crop — drag & drop, auto preview</h2>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div>
          <Label>Upload or drop images</Label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 cursor-pointer rounded-md border-2 border-dashed border-gray-300 p-4 text-center hover:border-gray-400 transition"
          >
            <div className="text-sm text-gray-600">Drop images here or click to select</div>
            <div className="text-xs text-gray-400">Supports multiple images</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 w-[180px]">
          <Label>Crop ratio</Label>
          <Select value={ratio} onValueChange={setRatio}>
            <SelectTrigger>
              <SelectValue placeholder="Tỉ lệ crop" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1">1 : 1</SelectItem>
              <SelectItem value="4:5">4 : 5</SelectItem>
              <SelectItem value="3:4">3 : 4</SelectItem>
              <SelectItem value="9:16">9 : 16</SelectItem>
              <SelectItem value="16:9">16 : 9</SelectItem>

            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <Button onClick={generateAllPreview}>Refresh Previews</Button>
          <Button variant="secondary" onClick={cropAll}>Crop All</Button>
          <Button variant="ghost" onClick={downloadAll}>Download All</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {images.map((img) => (
          <Card key={img.id} className="relative overflow-hidden">
            <CardHeader>
              <h3 className="font-medium text-sm truncate">{img.file.name}</h3>
              <CardAction onClick={() => setImages((prev) => prev.filter((p) => p.id !== img.id))}>
                Remove
              </CardAction>
            </CardHeader>
            <CardContent className="p-2">
              <div className="relative">
                <img src={img.preview ?? img.url} className="w-full rounded-lg object-contain max-h-48" />
                {img.loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="loader" />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="p-2">
              <div className="flex gap-2 w-full">
                <Button className="flex-1" onClick={() => generatePreviewAndUpdate(img)}>Preview</Button>
                <Button className="flex-1" variant="outline" onClick={() => downloadOne(img)}>Download</Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={previewCanvasRef} className="hidden" />
    </div>
  );
}
