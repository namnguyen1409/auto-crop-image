import { useState } from 'react';

export type ImageItem = {
  id: string;
  file: File;
  url: string;
  output?: string | null;
  preview?: string | null;
  faceBox?: any | null;
  customCrop?: { x: number; y: number; width: number; height: number } | null;
  loading?: boolean;
};

export default function useImages(initial: ImageItem[] = []) {
  const [images, setImages] = useState<ImageItem[]>(initial);

  const addFiles = (files: File[]) => {
    const list = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: f,
      url: URL.createObjectURL(f),
      output: null,
      preview: null,
      faceBox: null,
      customCrop: null,
      loading: true,
    }));
    setImages((prev) => {
      const merged = [...prev, ...list];
      return merged;
    });
    return list;
  };

  const updateImage = (id: string, patch: Partial<ImageItem>) => {
    setImages((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeImage = (id: string) => setImages((prev) => prev.filter((i) => i.id !== id));

  const resetCrop = (item: ImageItem) => {
    setImages((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, customCrop: null } : it))
    );
  };

  return { images, setImages, addFiles, updateImage, removeImage, resetCrop } as const;
}
