import { useEffect, useState } from 'react';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

export default function useFaceDetector() {
  const [detector, setDetector] = useState<FaceDetector | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

      const faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        },
        runningMode: 'IMAGE',
      });

      if (mounted) setDetector(faceDetector);
    };

    init();
    return () => { mounted = false; };
  }, []);

  return detector;
}
