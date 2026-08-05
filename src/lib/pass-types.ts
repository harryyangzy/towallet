export type PassCategory =
  | "loyalty"
  | "ticket"
  | "coupon"
  | "membership";

export interface PassData {
  id: string;
  name: string;
  type: string;
  expiry: string;
  color: string;
  addedOn: string;
  barcode: string;
}

export const CARD_TYPES = [
  "Membership",
  "Loyalty",
  "Ticket",
  "Coupon",
] as const;

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
  barcode: "GL-48291037",
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
  },
  {
    id: "2",
    name: "Goodlife",
    type: "Membership",
    expiry: "Jun 2027",
    color: "#F96304",
    addedOn: "March 18, 2026",
    barcode: "GL-48291037",
  },
  {
    id: "3",
    name: "Coastal Air CA 218",
    type: "Ticket",
    expiry: "Mar 14, 2026",
    color: "#39658D",
    addedOn: "March 10, 2026",
    barcode: "CA218-14A",
  },
  {
    id: "4",
    name: "Lumen Weekend 20%",
    type: "Coupon",
    expiry: "Apr 30, 2026",
    color: "#833563",
    addedOn: "March 5, 2026",
    barcode: "LUM-WEEK20",
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
