import React from 'react';
import { Card, CardAction, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Detection } from '@mediapipe/tasks-vision';
import { Trash } from 'lucide-react';

export interface ImageItemLite {
  id: string;
  file: File;
  url: string;
  output?: string | null;
  preview?: string | null;
  faceBox?: Detection['boundingBox'] | null;
  customCrop?: { x: number; y: number; width: number; height: number } | null;
  loading?: boolean;
}

interface Props {
  img: ImageItemLite;
  onRemove: (id: string) => void;
  onEdit: (img: ImageItemLite) => void;
  onDownload: (img: ImageItemLite) => void;
  onReset: (img: ImageItemLite) => void;
}

export const ImageCard = React.memo(function ImageCard({ img, onRemove, onEdit, onDownload, onReset }: Props) {
  return (
    <Card key={img.id} className="relative overflow-hidden">
      <CardHeader>
        <h3 className="font-medium text-sm truncate">{img.file.name}</h3>
        <CardAction onClick={() => onRemove(img.id)}>
            <Button variant="ghost" size="sm" className="p-0 text-red-500">
                <Trash />
            </Button>
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
          {img.customCrop && (
            <Button className="flex-1" variant="outline" onClick={() => onReset(img)}>
                Khôi phục
            </Button>
          )}
          <Button className="flex-1" variant="outline" onClick={() => onEdit(img)}>
            Chỉnh sửa
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => onDownload(img)}>
            Tải xuống
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
});

export default ImageCard;
