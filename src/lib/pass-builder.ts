import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { PKPass, PassType } from "passkit-generator";
import {
  BARCODE_FORMATS,
  CARD_STYLES,
  CARD_TYPES,
  STRIP_HEIGHT,
  STRIP_WIDTH,
  findPosterTheme,
  supportsPosterStyle,
  type BarcodeFormat,
  type CardStyle,
  type PosterTheme,
} from "@/lib/pass-types";

/**
 * Name of the poster image inside the .pkpass bundle, without its extension.
 * Sources conflict on "artwork" versus "background", so change it only here.
 */
const POSTER_IMAGE_NAME = "artwork";

const IMAGE_SCALES = ["", "@2x", "@3x"] as const;

const MAX_STRIP_BYTES = 3 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const APPLE_BARCODE_FORMATS: Record<BarcodeFormat, string> = {
  CODE128: "PKBarcodeFormatCode128",
  QR: "PKBarcodeFormatQR",
  PDF417: "PKBarcodeFormatPDF417",
  AZTEC: "PKBarcodeFormatAztec",
};

const PASS_STYLES = {
  Membership: "storeCard",
  Loyalty: "storeCard",
  Ticket: "eventTicket",
  Coupon: "coupon",
} as const;

export interface PassInput {
  name: string;
  type: (typeof CARD_TYPES)[number];
  expiry: string;
  color: string;
  barcode: string;
  barcodeFormat: BarcodeFormat;
  stripImage: Buffer | null;
  style: CardStyle;
  poster: { theme: PosterTheme; serial: string } | null;
}

export class PassInputError extends Error {}
export class PassConfigError extends Error {}

function parseStripImage(dataUrl: string | null): Buffer | null {
  if (!dataUrl) return null;

  const prefix = "data:image/png;base64,";
  const image = dataUrl.startsWith(prefix)
    ? Buffer.from(dataUrl.slice(prefix.length), "base64")
    : Buffer.alloc(0);

  if (
    image.length < 24 ||
    image.length > MAX_STRIP_BYTES ||
    !image.subarray(0, 8).equals(PNG_SIGNATURE) ||
    image.readUInt32BE(16) !== STRIP_WIDTH ||
    image.readUInt32BE(20) !== STRIP_HEIGHT
  ) {
    throw new PassInputError("That image couldn't be added to the pass.");
  }
  return image;
}

function parseCommonFields(params: URLSearchParams) {
  const name = params.get("name")?.trim() ?? "";
  const type = params.get("type") ?? "";
  const expiry = params.get("expiry")?.trim() ?? "";
  const color = params.get("color") ?? "";

  if (!name || name.length > 64) {
    throw new PassInputError("Enter a card name up to 64 characters.");
  }
  if (!CARD_TYPES.includes(type as PassInput["type"])) {
    throw new PassInputError("Choose a valid card type.");
  }
  if (expiry.length > 40) {
    throw new PassInputError("Keep the expiry to 40 characters or fewer.");
  }
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new PassInputError("Choose a valid card colour.");
  }

  return { name, type: type as PassInput["type"], expiry, color };
}

function parsePosterInput(params: URLSearchParams): PassInput {
  const common = parseCommonFields(params);
  const theme = findPosterTheme(params.get("artworkId"));
  const serial = params.get("serial") ?? "";

  if (!supportsPosterStyle(common.type)) {
    throw new PassInputError(
      "Poster is only available for Membership and Loyalty cards.",
    );
  }
  if (!theme) {
    throw new PassInputError("Choose a valid artwork theme.");
  }
  if (!/^[0-9a-f]{32}$/.test(serial)) {
    throw new PassInputError("This card has an invalid serial number.");
  }

  return {
    ...common,
    barcode: "",
    barcodeFormat: "CODE128",
    stripImage: null,
    style: "poster",
    poster: { theme, serial },
  };
}

export function parsePassInput(params: URLSearchParams): PassInput {
  const style = params.get("style") ?? "classic";
  if (!CARD_STYLES.includes(style as CardStyle)) {
    throw new PassInputError("Choose a valid card style.");
  }
  if (style === "poster") return parsePosterInput(params);

  const { name, type, expiry, color } = parseCommonFields(params);
  const stripImage = parseStripImage(params.get("stripImage"));
  const barcode = stripImage ? "" : (params.get("barcode")?.trim() ?? "");
  const barcodeFormat = params.get("barcodeFormat") ?? "";

  if (!BARCODE_FORMATS.includes(barcodeFormat as BarcodeFormat)) {
    throw new PassInputError("Choose a valid barcode format.");
  }
  if (!stripImage && (!barcode || barcode.length > 512)) {
    throw new PassInputError("Enter the barcode number from your card.");
  }
  if (
    !stripImage &&
    barcodeFormat === "CODE128" &&
    !/^[\x20-\x7e]+$/.test(barcode)
  ) {
    throw new PassInputError(
      "Code 128 barcodes can only contain standard letters, numbers and symbols.",
    );
  }

  return {
    name,
    type,
    expiry,
    color,
    barcode,
    barcodeFormat: barcodeFormat as BarcodeFormat,
    stripImage,
    style: "classic",
    poster: null,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PassConfigError(`${name} is not set.`);
  return value;
}

function pemFromEnv(name: string): Buffer {
  return Buffer.from(requireEnv(name), "base64");
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) =>
    parseInt(hex.slice(start, start + 2), 16),
  ) as [number, number, number];
}

function cssRgb(channels: readonly number[]): string {
  return `rgb(${channels.join(", ")})`;
}

function readableTextColor(hex: string): string {
  const [r, g, b] = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "rgb(33, 33, 33)" : "rgb(255, 255, 255)";
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

/** Draws the small rounded-square icon Wallet shows in notifications. */
function iconPng(size: number, hex: string): Buffer {
  const [r, g, b] = rgb(hex);
  const radius = size * 0.22;
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y++) {
    pixels[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x - 0.5, x + 0.5 - (size - radius), 0);
      const dy = Math.max(radius - y - 0.5, y + 0.5 - (size - radius), 0);
      const alpha = Math.max(0, Math.min(1, radius - Math.hypot(dx, dy) + 0.5));
      const offset = y * stride + 1 + x * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function signingDetails() {
  return {
    passTypeIdentifier: requireEnv("PASS_TYPE_IDENTIFIER"),
    teamIdentifier: requireEnv("PASS_TEAM_IDENTIFIER"),
    organizationName: process.env.PASS_ORGANIZATION_NAME?.trim() || "ToWallet",
    certificates: {
      wwdr: pemFromEnv("PASS_WWDR_CERT_BASE64"),
      signerCert: pemFromEnv("PASS_SIGNER_CERT_BASE64"),
      signerKey: pemFromEnv("PASS_SIGNER_KEY_BASE64"),
      signerKeyPassphrase: process.env.PASS_SIGNER_KEY_PASSPHRASE || undefined,
    },
  };
}

/** Reads bundled images for a theme that has already passed the allowlist. */
function posterImages(theme: PosterTheme): Record<string, Buffer> {
  const folder = path.join(process.cwd(), "public", "pass-artwork", theme.id);
  const images: Record<string, Buffer> = {};

  for (const scale of IMAGE_SCALES) {
    images[`${POSTER_IMAGE_NAME}${scale}.png`] = readFileSync(
      path.join(folder, `artwork${scale}.png`),
    );
    images[`strip${scale}.png`] = readFileSync(
      path.join(folder, `strip${scale}.png`),
    );
  }
  return images;
}

function buildPosterPass(
  input: PassInput,
  { theme, serial }: NonNullable<PassInput["poster"]>,
): Buffer {
  const { certificates, ...identity } = signingDetails();

  const pass = new PKPass(
    {
      "icon.png": iconPng(29, theme.background),
      "icon@2x.png": iconPng(58, theme.background),
      "icon@3x.png": iconPng(87, theme.background),
      ...posterImages(theme),
    },
    certificates,
    {
      ...identity,
      serialNumber: serial,
      description: `${input.name} ${input.type}`,
      backgroundColor: cssRgb(rgb(theme.background)),
      foregroundColor: cssRgb(rgb(theme.foreground)),
      labelColor: cssRgb(rgb(theme.labelColor)),
    },
  );

  const cardField = {
    key: "card",
    label: input.type.toUpperCase(),
    value: input.name,
  };
  const expiryField = { key: "expiry", label: "EXPIRES", value: input.expiry };

  const poster = new PassType("posterGeneric");
  poster.primaryFields.push({ ...cardField });
  poster.footerFields.push({ key: "type", label: "TYPE", value: input.type });

  // iOS 26 and earlier ignore posterGeneric and show this store card instead.
  const fallback = new PassType("storeCard");
  fallback.primaryFields.push({ ...cardField });

  if (input.expiry) {
    poster.headerFields.push({ ...expiryField });
    fallback.secondaryFields.push({ ...expiryField });
  }

  pass.types.push(poster, fallback);
  return pass.getAsBuffer();
}

export function buildPass(input: PassInput): Buffer {
  if (input.poster) return buildPosterPass(input, input.poster);

  const { certificates, passTypeIdentifier, teamIdentifier, organizationName } =
    signingDetails();

  // A stable serial lets re-adding the same card replace it in Wallet.
  const serialNumber = createHash("sha256")
    .update(`${input.barcodeFormat}\n${input.barcode}\n${input.name}\n`)
    .update(input.stripImage ?? Buffer.alloc(0))
    .digest("hex")
    .slice(0, 32);

  const pass = new PKPass(
    {
      "icon.png": iconPng(29, input.color),
      "icon@2x.png": iconPng(58, input.color),
      "icon@3x.png": iconPng(87, input.color),
      ...(input.stripImage && {
        "strip@2x.png": input.stripImage,
        "strip@3x.png": input.stripImage,
      }),
    },
    certificates,
    {
      serialNumber,
      passTypeIdentifier,
      teamIdentifier,
      organizationName,
      description: `${input.name} ${input.type}`,
      logoText: input.name,
      backgroundColor: cssRgb(rgb(input.color)),
      foregroundColor: readableTextColor(input.color),
      labelColor: readableTextColor(input.color),
    },
  );

  pass.type = PASS_STYLES[input.type];
  // Wallet draws primary fields on top of the strip, which would cover the code.
  if (!input.stripImage) {
    pass.primaryFields.push({
      key: "card",
      label: input.type.toUpperCase(),
      value: input.name,
    });
  }
  if (input.expiry) {
    pass.secondaryFields.push({
      key: "expiry",
      label: "EXPIRES",
      value: input.expiry,
    });
  }

  if (!input.stripImage) {
    const isLatin1 = [...input.barcode].every(
      (character) => (character.codePointAt(0) ?? 0) <= 0xff,
    );
    pass.setBarcodes({
      format: APPLE_BARCODE_FORMATS[input.barcodeFormat],
      message: input.barcode,
      messageEncoding: isLatin1 ? "iso-8859-1" : "utf-8",
      altText: input.barcode,
    } as Parameters<PKPass["setBarcodes"]>[0]);
  }

  return pass.getAsBuffer();
}

export function passFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "card"}.pkpass`;
}
