import sharp, {
  type Metadata,
  type PngOptions,
  type Raw,
  type SharpOptions,
} from "sharp";
import {
  MAX_POSTER_UPLOAD_BYTES,
  POSTER_HEIGHT,
  POSTER_WIDTH,
} from "@/lib/pass-types";

const MAX_INPUT_PIXELS = 50_000_000;
/** Leaves room for pass.json, icons and the signature under Wallet's 5 MB goal. */
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const MIN_TEXT_CONTRAST = 4.5;

const ARTWORK_SIZES = [
  [358, 448],
  [716, 896],
  [1074, 1344],
] as const;
const STRIP_SIZES = [
  [375, 123],
  [750, 246],
  [1125, 369],
] as const;

// Try full colour first, then palettes, which cap the size of a detailed photo.
const PNG_ENCODINGS: PngOptions[] = [
  { compressionLevel: 9 },
  { compressionLevel: 9, palette: true, quality: 95, effort: 8 },
  { compressionLevel: 9, palette: true, quality: 75, effort: 8 },
];

type Rgb = readonly [number, number, number];

export interface PosterColors {
  background: Rgb;
  foreground: Rgb;
  label: Rgb;
}

export interface PosterImages {
  /** Ordered 1x, 2x, 3x. */
  artwork: Buffer[];
  /** Ordered 1x, 2x, 3x. */
  strip: Buffer[];
  colors: PosterColors;
}

export class PosterImageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const UNREADABLE = "That image couldn't be read. Try a JPEG, PNG or WebP.";

function hasAllowedSignature(input: Buffer): boolean {
  const isJpeg = input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const isPng = input
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    input.subarray(0, 4).toString("latin1") === "RIFF" &&
    input.subarray(8, 12).toString("latin1") === "WEBP";
  return isJpeg || isPng || isWebp;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((index) =>
    Math.round(a[index] + (b[index] - a[index]) * amount),
  ) as unknown as Rgb;
}

/** Picks text colours from the lower area, where Wallet places the card text. */
async function sampleColors(pixels: Buffer, raw: Raw): Promise<PosterColors> {
  const top = Math.round(POSTER_HEIGHT * 0.65);
  const grid = await sharp(pixels, { raw })
    .extract({
      left: 0,
      top,
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT - top,
    })
    .resize(24, 8, { fit: "fill" })
    .raw()
    .toBuffer();

  const cells: Rgb[] = [];
  for (let index = 0; index < grid.length; index += 3) {
    cells.push([grid[index], grid[index + 1], grid[index + 2]]);
  }

  const background = [0, 1, 2].map((channel) =>
    Math.round(
      cells.reduce((sum, cell) => sum + cell[channel], 0) / cells.length,
    ),
  ) as unknown as Rgb;

  const worstContrast = (color: Rgb) =>
    Math.min(...cells.map((cell) => contrast(color, cell)));
  const light: Rgb = [255, 255, 255];
  const dark: Rgb = [17, 17, 17];
  const foreground = worstContrast(light) >= worstContrast(dark) ? light : dark;

  const softened = mix(foreground, background, 0.18);
  const label =
    contrast(softened, background) >= MIN_TEXT_CONTRAST ? softened : foreground;

  return { background, foreground, label };
}

async function renderImages(pixels: Buffer, raw: Raw, encoding: PngOptions) {
  const render = (sizes: readonly (readonly [number, number])[]) =>
    Promise.all(
      sizes.map(([width, height]) =>
        sharp(pixels, { raw })
          .resize(width, height, { fit: "cover", position: "centre" })
          .png(encoding)
          .toBuffer(),
      ),
    );
  const [artwork, strip] = await Promise.all([
    render(ARTWORK_SIZES),
    render(STRIP_SIZES),
  ]);
  return { artwork, strip };
}

async function decodeToPoster(input: Buffer) {
  const options: SharpOptions = {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "error",
    animated: false,
  };

  let metadata: Metadata;
  try {
    // Reads only the header, so the size can be checked before decoding.
    metadata = await sharp(input, {
      ...options,
      limitInputPixels: false,
    }).metadata();
  } catch {
    throw new PosterImageError(UNREADABLE, 400);
  }

  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
    throw new PosterImageError("Use a JPEG, PNG or WebP image.", 415);
  }
  if ((metadata.width ?? 0) * (metadata.height ?? 0) > MAX_INPUT_PIXELS) {
    throw new PosterImageError("That image has too many pixels.", 413);
  }

  try {
    // Output is rebuilt from raw pixels, so no input metadata can carry over.
    return await sharp(input, options)
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize(POSTER_WIDTH, POSTER_HEIGHT, {
        fit: "cover",
        position: "centre",
      })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new PosterImageError(UNREADABLE, 400);
  }
}

export async function processPosterImage(input: Buffer): Promise<PosterImages> {
  if (input.length > MAX_POSTER_UPLOAD_BYTES) {
    throw new PosterImageError("That image is over the 4 MB limit.", 413);
  }
  if (!hasAllowedSignature(input)) {
    throw new PosterImageError("Use a JPEG, PNG or WebP image.", 415);
  }

  const { data: pixels, info } = await decodeToPoster(input);
  const raw: Raw = {
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
  const colors = await sampleColors(pixels, raw);

  for (const encoding of PNG_ENCODINGS) {
    const images = await renderImages(pixels, raw, encoding);
    const size = [...images.artwork, ...images.strip].reduce(
      (total, image) => total + image.length,
      0,
    );
    if (size <= MAX_IMAGE_BYTES) return { ...images, colors };
  }

  throw new PosterImageError("That image is too detailed to add.", 413);
}
