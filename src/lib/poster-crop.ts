import {
  MAX_POSTER_SOURCE_BYTES,
  MAX_POSTER_UPLOAD_BYTES,
  POSTER_HEIGHT,
  POSTER_WIDTH,
} from "@/lib/pass-types";

/** Frame height when the frame's width is 1. */
const FRAME_HEIGHT = POSTER_HEIGHT / POSTER_WIDTH;
const JPEG_QUALITIES = [0.9, 0.82, 0.72, 0.6];

export const MIN_POSTER_ZOOM = 1;
export const MAX_POSTER_ZOOM = 4;

export interface PosterSource {
  url: string;
  width: number;
  height: number;
}

/** Image centre offset, measured in frame widths from the frame's centre. */
export interface PosterCrop {
  zoom: number;
  x: number;
  y: number;
}

export class PosterImageReadError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = url;
  });
}

export async function loadPosterSource(file: File): Promise<PosterSource> {
  if (file.size > MAX_POSTER_SOURCE_BYTES) {
    throw new PosterImageReadError("That image is over the 40 MB limit.");
  }
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    throw new PosterImageReadError("SVG images can't be used on a pass.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("Image has no size");
    }
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    URL.revokeObjectURL(url);
    throw new PosterImageReadError("That image couldn't be read.");
  }
}

/** Size of one source pixel, in frame widths. */
export function posterScale(source: PosterSource, zoom: number): number {
  return Math.max(1 / source.width, FRAME_HEIGHT / source.height) * zoom;
}

export function clampPosterCrop(
  source: PosterSource,
  crop: PosterCrop,
): PosterCrop {
  const zoom = Math.min(MAX_POSTER_ZOOM, Math.max(MIN_POSTER_ZOOM, crop.zoom));
  const scale = posterScale(source, zoom);
  const maxX = Math.max(0, (source.width * scale - 1) / 2);
  const maxY = Math.max(0, (source.height * scale - FRAME_HEIGHT) / 2);

  return {
    zoom,
    x: Math.min(maxX, Math.max(-maxX, crop.x)),
    y: Math.min(maxY, Math.max(-maxY, crop.y)),
  };
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not export image")),
      "image/jpeg",
      quality,
    );
  });
}

export async function exportPosterCrop(
  source: PosterSource,
  crop: PosterCrop,
): Promise<Blob> {
  const image = await loadImage(source.url);
  const scale = posterScale(source, crop.zoom);
  const sourceWidth = 1 / scale;
  const sourceHeight = FRAME_HEIGHT / scale;

  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  // JPEG has no transparency, so see-through areas become white.
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    source.width / 2 - crop.x / scale - sourceWidth / 2,
    source.height / 2 - crop.y / scale - sourceHeight / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    POSTER_WIDTH,
    POSTER_HEIGHT,
  );

  for (const quality of JPEG_QUALITIES) {
    const blob = await canvasToJpeg(canvas, quality);
    if (blob.size <= MAX_POSTER_UPLOAD_BYTES) return blob;
  }
  throw new PosterImageReadError("That image is too detailed to use.");
}
