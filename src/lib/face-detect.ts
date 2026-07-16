// Best-effort face detection using the browser's built-in FaceDetector API
// (Chromium / Android WebView). No model download, no external service, no
// data leaves the device — detection runs locally on the pixels. Everything
// degrades to `null` ("not supported / couldn't run") so callers can simply
// skip the face UI when the API isn't there.

interface FaceDetectorLike {
  detect: (
    source: CanvasImageSource,
  ) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
}

declare global {
  interface Window {
    FaceDetector?: new (opts?: {
      fastMode?: boolean;
      maxDetectedFaces?: number;
    }) => FaceDetectorLike;
  }
}

/** Whether this browser can detect faces locally. */
export function faceDetectionSupported(): boolean {
  return typeof window !== "undefined" && typeof window.FaceDetector === "function";
}

/** Count faces in an already-decoded image/video element. Null if unsupported. */
export async function countFaces(
  source: HTMLImageElement | HTMLVideoElement,
): Promise<number | null> {
  if (!faceDetectionSupported()) return null;
  try {
    const detector = new window.FaceDetector!({
      fastMode: true,
      maxDetectedFaces: 20,
    });
    const faces = await detector.detect(source);
    return faces.length;
  } catch {
    return null;
  }
}

/**
 * Count faces in an image given a URL/object-URL. Loads the image off-DOM,
 * runs detection, and cleans up. Null when unsupported or on any error.
 */
export async function countFacesInImageUrl(
  url: string,
): Promise<number | null> {
  if (!faceDetectionSupported()) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      resolve(await countFaces(img));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
