"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { X } from "lucide-react";
import {
  MAX_POSTER_ZOOM,
  MIN_POSTER_ZOOM,
  PosterImageReadError,
  clampPosterCrop,
  exportPosterCrop,
  posterScale,
  type PosterCrop,
  type PosterSource,
} from "@/lib/poster-crop";

type Point = { x: number; y: number };

const FRAME_HEIGHT_RATIO = 1.25;
const KEYBOARD_STEP = 0.03;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PosterCropSheet({
  source,
  onCancel,
  onApply,
}: {
  source: PosterSource;
  onCancel: () => void;
  onApply: (image: Blob) => void;
}) {
  const [crop, setCrop] = useState<PosterCrop>({ zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());

  const moveBy = (dx: number, dy: number) => {
    setCrop((current) =>
      clampPosterCrop(source, {
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      }),
    );
  };

  const zoomTo = (getZoom: (zoom: number) => number) => {
    setCrop((current) => {
      const zoom = Math.min(
        MAX_POSTER_ZOOM,
        Math.max(MIN_POSTER_ZOOM, getZoom(current.zoom)),
      );
      // Scaling the offset keeps the same point at the centre of the frame.
      const ratio = zoom / current.zoom;
      return clampPosterCrop(source, {
        zoom,
        x: current.x * ratio,
        y: current.y * ratio,
      });
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    const frameWidth = frameRef.current?.getBoundingClientRect().width;
    if (!previous || !frameWidth) return;

    const next = { x: event.clientX, y: event.clientY };
    const other = [...pointers.current].find(
      ([id]) => id !== event.pointerId,
    )?.[1];
    pointers.current.set(event.pointerId, next);

    if (other) {
      const before = distance(previous, other);
      if (before > 0) {
        const ratio = distance(next, other) / before;
        zoomTo((zoom) => zoom * ratio);
      }
      moveBy(
        (next.x - previous.x) / 2 / frameWidth,
        (next.y - previous.y) / 2 / frameWidth,
      );
      return;
    }
    moveBy(
      (next.x - previous.x) / frameWidth,
      (next.y - previous.y) / frameWidth,
    );
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEYBOARD_STEP, 0],
      ArrowRight: [-KEYBOARD_STEP, 0],
      ArrowUp: [0, KEYBOARD_STEP],
      ArrowDown: [0, -KEYBOARD_STEP],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveBy(move[0], move[1]);
  };

  const handleApply = async () => {
    setExporting(true);
    setError(null);
    try {
      onApply(await exportPosterCrop(source, crop));
    } catch (failure) {
      setError(
        failure instanceof PosterImageReadError
          ? failure.message
          : "That image couldn't be cropped. Try a different one.",
      );
      setExporting(false);
    }
  };

  const scale = posterScale(source, crop.zoom);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-[2px]">
      <div className="animate-screen-in max-h-full overflow-y-auto rounded-t-[28px] bg-[#212121] px-6 pt-5 pb-7">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold text-white">
              Crop Your Image
            </h2>
            <p className="mt-1 text-[12px] text-white/55">
              Drag to move. Pinch or use the slider to zoom.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Cancel crop"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          ref={frameRef}
          role="application"
          aria-label="Crop frame. Use arrow keys to move the image."
          tabIndex={0}
          data-testid="poster-crop-frame"
          className="relative mx-auto aspect-[4/5] cursor-grab touch-none overflow-hidden rounded-[18px] bg-black outline-none select-none focus-visible:ring-2 focus-visible:ring-[#FF9B5B] active:cursor-grabbing"
          style={{
            width: `min(100%, calc((100dvh - 330px) / ${FRAME_HEIGHT_RATIO}))`,
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onKeyDown={handleKeyDown}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img
            src={source.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${50 + crop.x * 100}%`,
              top: `${50 + (crop.y / FRAME_HEIGHT_RATIO) * 100}%`,
              width: `${source.width * scale * 100}%`,
            }}
          />

          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-y-0 left-0 w-[5%] bg-white/20" />
            <div className="absolute inset-y-0 right-0 w-[5%] bg-white/20" />
            <div className="absolute top-[4%] left-[5%] flex h-[12%] w-[40%] items-center justify-center rounded-[6px] border border-dashed border-white/80 bg-black/20 text-[10px] font-bold text-white">
              Logo area
            </div>
            <div className="absolute inset-x-0 bottom-0 flex h-[26%] items-center justify-center border-t border-dashed border-white/80 bg-black/35 text-[10px] font-bold text-white">
              Card text
            </div>
          </div>
        </div>

        <label className="mt-4 flex min-h-11 items-center gap-3 text-[12px] font-bold text-white">
          Zoom
          <input
            type="range"
            min={MIN_POSTER_ZOOM}
            max={MAX_POSTER_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(event) => zoomTo(() => Number(event.target.value))}
            className="h-11 min-w-0 flex-1 accent-[#FF9B5B]"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mb-2 text-center text-[12px] text-[#FF9B5B]"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={exporting}
          className="mt-1 flex h-[48px] w-full items-center justify-center rounded-[14px] bg-[#FF9B5B] text-[15px] font-bold text-[#212121] active:opacity-90 disabled:opacity-60"
        >
          {exporting ? "Preparing Image…" : "Use This Crop"}
        </button>
      </div>
    </div>
  );
}
