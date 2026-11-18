import type { BarcodeFormat as WalletBarcodeFormat } from "@/lib/pass-types";

export interface ScannedBarcode {
  value: string;
  format: WalletBarcodeFormat;
  /** Set when Wallet can't show the original symbology, such as EAN-13 or UPC. */
  unsupportedFormat: string | null;
}

export async function scanBarcodeFromFile(file: File): Promise<ScannedBarcode> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
    await Promise.all([import("@zxing/browser"), import("@zxing/library")]);

  const walletFormats = new Map<number, WalletBarcodeFormat>([
    [BarcodeFormat.CODE_128, "CODE128"],
    [BarcodeFormat.QR_CODE, "QR"],
    [BarcodeFormat.PDF_417, "PDF417"],
    [BarcodeFormat.AZTEC, "AZTEC"],
  ]);

  const reader = new BrowserMultiFormatReader(
    new Map([[DecodeHintType.TRY_HARDER, true]])
  );
  const imageUrl = URL.createObjectURL(file);

  try {
    const result = await reader.decodeFromImageUrl(imageUrl);
    const detected = result.getBarcodeFormat();
    const format = walletFormats.get(detected);

    return {
      value: result.getText(),
      format: format ?? "CODE128",
      unsupportedFormat: format ? null : BarcodeFormat[detected],
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
