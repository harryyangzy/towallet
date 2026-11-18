"use client";

import { useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import { renderStripImage, type CropArea } from "@/lib/strip-image";

const FULL_IMAGE: CropArea = { x: 0, y: 0, width: 1, height: 1 };

export function CropSheet({
  imageUrl,
  onCancel,
  onApply,
}: {
  imageUrl: string;
  onCancel: () => void;
  onApply: (stripImage: string) => void;
}) {
  const [crop, setCrop] = useState<CropArea>(FULL_IMAGE);
  const [failed, setFailed] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handleApply = async () => {
    try {
      onApply(await renderStripImage(imageUrl, crop));
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/55 backdrop-blur-[2px]">
      <div className="animate-screen-in rounded-t-[28px] bg-[#212121] px-6 pt-5 pb-8">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[20px] font-bold text-white">Use Your Image</p>
            <p className="mt-1 text-[12px] text-white/55">
              Drag around the barcode to show it on your pass.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Cancel"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          ref={frameRef}
          className="relative mx-auto mb-5 w-fit touch-none overflow-hidden rounded-[12px] bg-white select-none"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragStart.current = pointFromEvent(event);
          }}
          onPointerMove={(event) => {
            if (!dragStart.current) return;
            const start = dragStart.current;
            const point = pointFromEvent(event);
            setCrop({
              x: Math.min(start.x, point.x),
              y: Math.min(start.y, point.y),
              width: Math.abs(point.x - start.x),
              height: Math.abs(point.y - start.y),
            });
          }}
          onPointerUp={() => {
            dragStart.current = null;
            setCrop((area) =>
              area.width < 0.03 || area.height < 0.03 ? FULL_IMAGE : area
            );
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img
            src={imageUrl}
            alt="Your uploaded card"
            draggable={false}
            className="block max-h-[320px] max-w-full"
          />
          <div
            className="pointer-events-none absolute border-2 border-[#FF9B5B] shadow-[0_0_0_999px_rgba(0,0,0,0.45)]"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
          />
        </div>

        {failed && (
          <p role="alert" className="mb-3 text-center text-[12px] text-[#FF9B5B]">
            This image couldn&apos;t be used. Try a different one.
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleApply()}
          className="flex h-[48px] w-full items-center justify-center rounded-[14px] bg-[#FF9B5B] text-[15px] font-bold text-[#212121] active:opacity-90"
        >
          Use This Area
        </button>
      </div>
    </div>
  );
}
