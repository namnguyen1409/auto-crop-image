import { useEffect, useRef, useState } from "react";
import useFaceDetector from '@/hooks/useFaceDetector';
import useImages from '@/hooks/useImages';
import useCrop from '@/hooks/useCrop';

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
// card UI components are used by ImageCard
import { Label } from "@/components/ui/label";
import ImageCard from './ImageCard';
import EditCropModal from './EditCropModal';


interface ImageItem {
  id: string;
  file: File;
  url: string;
  output?: string | null;
  preview?: string | null;
  faceBox?: any | null;
  // customCrop stores an explicit crop rectangle in image pixels (x,y,width,height)
  // when user manually edits the crop. If present, cropping will use this instead of auto-centering on faceBox.
  customCrop?: { x: number; y: number; width: number; height: number } | null;
  loading?: boolean;
}

export default function FaceCropPage() {
  const detector = useFaceDetector();
  const { images, addFiles, updateImage, removeImage, resetCrop } = useImages();
  const [ratio, setRatio] = useState<string>("1:1");

  const crop = useCrop();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingItem, setEditingItem] = useState<ImageItem | null>(null);

  // detector initialized by useFaceDetector hook
  // const detector = useFaceDetector();

  // loadImage is handled inside useCrop hook

  // updateImage provided by useImages

  const generatePreview = (item: ImageItem) => crop.generatePreview(item, detector, ratio);

  // open edit modal for an image is done by setting editingItem directly

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
    const list = addFiles(files);
    list.forEach((it) => void generatePreviewAndUpdate(it));
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const list = addFiles(files);
    list.forEach((it) => void generatePreviewAndUpdate(it));
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

  const cropWithFace = (src: string, faceBox: any | null, ratioStr: string, customCrop?: { x: number; y: number; width: number; height: number } | null) =>
    crop.cropWithFace(src, faceBox, ratioStr, customCrop);

  const cropAll = async () => {
    for (const img of images) {
      updateImage(img.id, { loading: true });
      try {
        const out = await cropWithFace(img.url, img.faceBox ?? null, ratio, img.customCrop ?? null);
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
      const out = await cropWithFace(img.url, img.faceBox ?? null, ratio, img.customCrop ?? null);
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
      <h2 className="text-2xl font-bold">
        Tự động cắt ảnh khuôn mặt — kéo & thả, xem trước tự động
      </h2>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div>
          <Label>Tải lên hoặc thả ảnh</Label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 cursor-pointer rounded-md border-2 border-dashed border-gray-300 p-4 text-center hover:border-gray-400 transition"
          >
            <div className="text-sm text-gray-600">Thả ảnh vào đây hoặc click để chọn</div>
            <div className="text-xs text-gray-400">Hỗ trợ nhiều ảnh</div>
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
          <Label>Tỉ lệ crop</Label>
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
          <Button onClick={generateAllPreview}>Làm mới xem trước</Button>
          <Button variant="secondary" onClick={cropAll}>Cắt tất cả</Button>
          <Button variant="ghost" onClick={downloadAll}>Tải tất cả</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {images.map((img) => (
          <ImageCard
            key={img.id}
            img={img}
            onRemove={(id) => removeImage(id)}
            onEdit={(i) => setEditingItem(i)}
            onReset={(i) => {
              resetCrop(i);
              void generatePreviewAndUpdate({ ...i, customCrop: undefined });
            }}
            onDownload={(i) => void downloadOne(i)}
          />
        ))}
      </div>

      {editingItem && (
        <EditCropModal
          item={editingItem}
          ratio={ratio}
          onSave={(crop) => {
            updateImage(editingItem.id, { customCrop: crop });
            // regenerate preview
            void generatePreviewAndUpdate({ ...editingItem, customCrop: crop });
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

  {/* canvases are handled inside hooks */}
    </div>
  );
}
