import { STRIP_HEIGHT, STRIP_WIDTH } from "@/lib/pass-types";

/** Crop position and size, each from 0 to 1 of the source image. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Event tickets show a shorter strip, so keep the code inside the shared area.
const SAFE_WIDTH = STRIP_WIDTH - 90;
const SAFE_HEIGHT = 294;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = url;
  });
}

export async function renderStripImage(
  imageUrl: string,
  crop: CropArea
): Promise<string> {
  const image = await loadImage(imageUrl);
  const sourceX = crop.x * image.naturalWidth;
  const sourceY = crop.y * image.naturalHeight;
  const sourceWidth = crop.width * image.naturalWidth;
  const sourceHeight = crop.height * image.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = STRIP_WIDTH;
  canvas.height = STRIP_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  const scale = Math.min(SAFE_WIDTH / sourceWidth, SAFE_HEIGHT / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  // Enlarging without smoothing keeps barcode bars crisp.
  context.imageSmoothingEnabled = scale < 1;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    (STRIP_WIDTH - width) / 2,
    (STRIP_HEIGHT - height) / 2,
    width,
    height
  );

  return canvas.toDataURL("image/png");
}
