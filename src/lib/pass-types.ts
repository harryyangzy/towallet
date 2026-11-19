export type PassCategory = "loyalty" | "ticket" | "coupon" | "membership";

export interface PassData {
  id: string;
  name: string;
  type: string;
  expiry: string;
  color: string;
  addedOn: string;
  barcode: string;
  barcodeFormat: BarcodeFormat;
  /** PNG data URL shown on the pass instead of a Wallet-generated barcode. */
  stripImage?: string;
  /** Cards without a style are Classic. */
  style?: CardStyle;
  /** Cropped Poster image, kept only while the app is open. */
  posterImage?: Blob;
  /** Object URL for posterImage, revoked once no card uses it. */
  posterImageUrl?: string;
  /** Created once for a Poster card and reused every time it is added. */
  serial?: string;
}

export const STRIP_WIDTH = 1125;
export const STRIP_HEIGHT = 432;

export const CARD_STYLES = ["classic", "poster"] as const;

export type CardStyle = (typeof CARD_STYLES)[number];

export const POSTER_WIDTH = 1074;
export const POSTER_HEIGHT = 1344;
export const MAX_POSTER_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_POSTER_SOURCE_BYTES = 40 * 1024 * 1024;

export function supportsPosterStyle(type: string): boolean {
  return type === "Membership" || type === "Loyalty";
}

export function isPosterCard(pass: PassData): boolean {
  return pass.style === "poster";
}

/** Uses getRandomValues because randomUUID is unavailable over plain HTTP. */
export function createPassSerial(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export const CARD_TYPES = [
  "Membership",
  "Loyalty",
  "Ticket",
  "Coupon",
] as const;

/** The only barcode symbologies Apple Wallet can display. */
export const BARCODE_FORMATS = ["CODE128", "QR", "PDF417", "AZTEC"] as const;

export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

export const BARCODE_FORMAT_LABELS: Record<BarcodeFormat, string> = {
  CODE128: "Code 128",
  QR: "QR Code",
  PDF417: "PDF417",
  AZTEC: "Aztec",
};

export const COLOR_STOPS = [
  "#FF9B5B",
  "#E65E5E",
  "#B3AE49",
  "#3E9A40",
  "#39658D",
  "#603787",
  "#833563",
  "#803435",
] as const;

export const COLOR_GRADIENT =
  "linear-gradient(90deg, #E65E5E 0%, #FF9B5B 18%, #B3AE49 50%, #3E9A40 75%, #39658D 87.5%, #603787 93.75%, #833563 96.875%, #803435 100%)";

export const DEFAULT_PASS: PassData = {
  id: "draft",
  name: "Goodlife",
  type: "Membership",
  expiry: "Dec 2026",
  color: "#FF9B5B",
  addedOn: "March 21, 2026",
  barcode: "",
  barcodeFormat: "CODE128",
};

export const EXAMPLE_PASSES: PassData[] = [
  {
    id: "1",
    name: "Optimum Membership",
    type: "Membership",
    expiry: "Dec 2026",
    color: "#FF9B5B",
    addedOn: "March 21, 2026",
    barcode: "OPT-882104",
    barcodeFormat: "CODE128",
  },
  {
    id: "2",
    name: "Goodlife",
    type: "Membership",
    expiry: "Jun 2027",
    color: "#3E9A40",
    addedOn: "March 18, 2026",
    barcode: "GL-48291037",
    barcodeFormat: "CODE128",
  },
  {
    id: "3",
    name: "Coastal Air CA 218",
    type: "Ticket",
    expiry: "Mar 14, 2026",
    color: "#39658D",
    addedOn: "March 10, 2026",
    barcode: "CA218-14A",
    barcodeFormat: "QR",
  },
  {
    id: "4",
    name: "Lumen Weekend 20%",
    type: "Coupon",
    expiry: "Apr 30, 2026",
    color: "#833563",
    addedOn: "March 5, 2026",
    barcode: "LUM-WEEK20",
    barcodeFormat: "CODE128",
  },
];

export function colorFromSlider(position: number): string {
  const clamped = Math.min(1, Math.max(0, position));
  const scaled = clamped * (COLOR_STOPS.length - 1);
  const index = Math.round(scaled);
  return COLOR_STOPS[index] ?? COLOR_STOPS[0];
}

export function darkenHex(hex: string, amount = 0.22): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return hex;
  const channel = (start: number) => {
    const value = parseInt(cleaned.slice(start, start + 2), 16);
    const next = Math.max(0, Math.round(value * (1 - amount)));
    return next.toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

export function formatAddedOn(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
