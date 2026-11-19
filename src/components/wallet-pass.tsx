"use client";

import { cn } from "@/lib/utils";
import { darkenHex, isPosterCard, type PassData } from "@/lib/pass-types";

interface WalletCardProps {
  pass: PassData;
  className?: string;
  showBarcode?: boolean;
}

function FakeBarcode({ value }: { value: string }) {
  const bars = Array.from({ length: 42 }, (_, i) => {
    let hash = 0;
    for (let c = 0; c < value.length; c++) {
      hash = (hash << 5) - hash + value.charCodeAt(c) + i;
      hash |= 0;
    }
    return ((Math.abs(hash) + i * 17) % 3) + 1;
  });

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-10 w-full items-stretch justify-center gap-px overflow-hidden rounded-sm bg-white px-2 py-1">
        {bars.map((width, index) => (
          <span
            key={`${index}-${width}`}
            className="bg-[#212121]"
            style={{ width: `${width}px` }}
          />
        ))}
      </div>
      <p className="font-mono text-[9px] tracking-[0.16em] text-[#212121]/70 uppercase">
        {value}
      </p>
    </div>
  );
}

const ACCENT_PATH =
  "M0 40.0134C0 14.7868 23.0664 -4.14114 47.8076 0.782887L276.808 46.36C295.522 50.0847 309 66.5093 309 85.5905V283.058L222.901 332.767H26C11.6406 332.767 0 321.127 0 306.767V40.0134Z";

function PosterCard({ pass, className }: WalletCardProps) {
  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-[26px] border border-white/10 bg-[#2B2B2B] text-white",
        className,
      )}
      data-testid="poster-card"
    >
      {pass.posterImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img
          src={pass.posterImageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <p className="absolute inset-x-6 top-[38%] text-center text-[14px] font-bold text-white/60">
          Add an image
        </p>
      )}

      {pass.expiry && (
        <div className="absolute top-3 right-3 z-10 rounded-[10px] bg-black/55 px-2.5 py-1.5 text-right">
          <p className="text-[9px] leading-none font-bold tracking-[0.08em] text-white/75">
            EXPIRES
          </p>
          <p className="mt-1 text-[13px] leading-none font-bold">
            {pass.expiry}
          </p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 bg-black/65 px-5 pt-3 pb-5">
        <p className="truncate text-[24px] leading-tight font-bold">
          {pass.name || "Card"}
        </p>
        <div>
          <p className="text-[9px] leading-none font-bold tracking-[0.08em] text-white/75">
            TYPE
          </p>
          <p className="mt-1 text-[13px] leading-none font-bold">{pass.type}</p>
        </div>
      </div>
    </div>
  );
}

export function WalletCard({
  pass,
  className,
  showBarcode = true,
}: WalletCardProps) {
  if (isPosterCard(pass)) {
    return <PosterCard pass={pass} className={className} />;
  }

  const accent = darkenHex(pass.color, 0.18);

  return (
    <div
      className={cn(
        "relative aspect-[309/385] w-full overflow-hidden rounded-[26px] border border-white/10",
        className,
      )}
      style={{ backgroundColor: pass.color }}
    >
      <p className="absolute top-[20px] right-[24px] z-20 text-[24px] leading-none font-normal text-[#212121]">
        {pass.name || "Card"}
      </p>

      <div className="absolute inset-x-0 top-[43.5px] bottom-0 z-0">
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 309 332.767"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={ACCENT_PATH} fill={accent} />
        </svg>
      </div>

      {showBarcode && (
        <div className="absolute inset-x-6 bottom-10 z-20 rounded-[12px] bg-white/95 px-3 py-2.5 shadow-sm">
          {pass.stripImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img
              src={pass.stripImage}
              alt="Barcode from your image"
              className="w-full rounded-sm"
            />
          ) : (
            <FakeBarcode value={pass.barcode || "TOWALLET"} />
          )}
        </div>
      )}

      <div
        className="absolute right-[18px] bottom-[18px] z-20 size-[11px] rounded-full"
        style={{ backgroundColor: darkenHex(pass.color, 0.28) }}
      />
    </div>
  );
}
