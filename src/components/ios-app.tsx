"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import Image from "next/image";
import {
  Check,
  ChevronRight,
  CircleAlert,
  ImagePlus,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { CropSheet } from "@/components/crop-sheet";
import { PosterCropSheet } from "@/components/poster-crop-sheet";
import { WalletCard } from "@/components/wallet-pass";
import { scanBarcodeFromFile } from "@/lib/barcode-scan";
import {
  BARCODE_FORMATS,
  BARCODE_FORMAT_LABELS,
  CARD_TYPES,
  COLOR_GRADIENT,
  DEFAULT_PASS,
  EXAMPLE_PASSES,
  colorFromSlider,
  createPassSerial,
  darkenHex,
  formatAddedOn,
  isPosterCard,
  supportsPosterStyle,
  type BarcodeFormat,
  type CardStyle,
  type PassData,
} from "@/lib/pass-types";
import {
  PosterImageReadError,
  loadPosterSource,
  type PosterSource,
} from "@/lib/poster-crop";
import { cn } from "@/lib/utils";

type Tab = "create" | "passes";
type FieldKey = "name" | "type" | "expiry" | "barcode" | "barcodeFormat";
type ToastState = { message: string; tone: "success" | "error" };

function StatusBar() {
  const [time, setTime] = useState("9:41");

  useEffect(() => {
    const tick = () => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative z-30 flex h-[54px] shrink-0 items-end px-7 pb-2 text-[15px] font-semibold text-white">
      <span className="w-16 tabular-nums tracking-tight">{time}</span>
      <div className="pointer-events-none absolute top-2.5 left-1/2 h-[34px] w-[118px] -translate-x-1/2 rounded-full bg-black" />
      <div className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold">
        <span className="tracking-tighter">■■■□</span>
        <span>􀙇</span>
        <span className="rounded-[4px] border border-white px-1 py-px text-[9px] leading-none">
          100
        </span>
      </div>
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="shrink-0 border-t border-white/10 bg-[#212121]/95 backdrop-blur-xl">
      <div className="grid h-[52px] grid-cols-2 px-2 pt-1">
        <button
          type="button"
          onClick={() => onChange("create")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors",
            tab === "create" ? "text-[#FF9B5B]" : "text-white/40",
          )}
        >
          <Plus className="size-5" strokeWidth={tab === "create" ? 2.6 : 2} />
          Add
        </button>
        <button
          type="button"
          onClick={() => onChange("passes")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors",
            tab === "passes" ? "text-[#FF9B5B]" : "text-white/40",
          )}
        >
          <Wallet
            className="size-[18px]"
            strokeWidth={tab === "passes" ? 2.6 : 2}
          />
          Wallet
        </button>
      </div>
      <div className="mx-auto mb-2 h-[5px] w-[134px] rounded-full bg-white" />
    </div>
  );
}

function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-8 top-[70px] z-[60] flex justify-center"
    >
      <div className="animate-screen-in flex items-center gap-2 rounded-[14px] bg-white px-4 py-2.5 text-[13px] font-bold text-[#212121] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.55)]">
        {toast.tone === "success" ? (
          <Check className="size-4 shrink-0 text-[#3E9A40]" strokeWidth={2.5} />
        ) : (
          <CircleAlert
            className="size-4 shrink-0 text-[#E65E5E]"
            strokeWidth={2.5}
          />
        )}
        {toast.message}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  active,
  onFocus,
  children,
}: {
  label: string;
  active: boolean;
  onFocus: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2.5 rounded-l-[20px] border border-solid p-2.5 transition-colors",
        active ? "border-[#FF9B5B]" : "border-white/60",
      )}
      onFocusCapture={onFocus}
    >
      <div className="relative size-1 shrink-0 overflow-hidden">
        <Image
          src={active ? "/figma/orange-dot-sm.svg" : "/figma/muted-dot-sm.svg"}
          alt=""
          width={4}
          height={4}
          className="size-full"
          unoptimized
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[12px] leading-none">
        <span className="shrink-0 font-bold text-white">{label}</span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          <div className="min-w-0 flex-1 text-right">{children}</div>
          <ChevronRight className="size-3.5 shrink-0 text-white/35" />
        </div>
      </div>
    </div>
  );
}

function ColorSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      className="relative h-8 w-full cursor-pointer rounded-r-full rounded-l-none touch-none"
      style={{ backgroundImage: COLOR_GRADIENT }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        setFromClientX(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(Math.max(0, value - 0.05));
        if (e.key === "ArrowRight") onChange(Math.min(1, value + 0.05));
      }}
    >
      <div
        className="pointer-events-none absolute top-1/2 size-[11px] -translate-y-1/2"
        style={{ left: `calc(${value * 100}% - 5.5px)` }}
      >
        <Image
          src="/figma/slider-thumb.svg"
          alt=""
          width={11}
          height={11}
          className="size-full"
          unoptimized
        />
      </div>
    </div>
  );
}

function StylePicker({
  value,
  onChange,
}: {
  value: CardStyle;
  onChange: (style: CardStyle) => void;
}) {
  const options: { style: CardStyle; label: string }[] = [
    { style: "classic", label: "Classic" },
    { style: "poster", label: "Poster" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Card style"
      className="grid grid-cols-2 gap-1 rounded-[14px] bg-white/8 p-1"
    >
      {options.map(({ style, label }) => (
        <button
          key={style}
          type="button"
          role="radio"
          aria-checked={value === style}
          onClick={() => onChange(style)}
          className={cn(
            "h-10 rounded-[10px] text-[14px] font-bold transition-colors",
            value === style ? "bg-[#FF9B5B] text-[#212121]" : "text-white/70",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CreateScreen({
  pass,
  setPass,
  uploadedName,
  addingToWallet,
  onUpload,
  onPosterUpload,
  onScan,
  onSave,
  onAddToWallet,
  onReset,
}: {
  pass: PassData;
  setPass: Dispatch<SetStateAction<PassData>>;
  uploadedName: string | null;
  addingToWallet: boolean;
  onUpload: () => void;
  onPosterUpload: () => void;
  onScan: () => void;
  onSave: () => void;
  onAddToWallet: () => void;
  onReset: () => void;
}) {
  const [activeField, setActiveField] = useState<FieldKey>("name");
  const [slider, setSlider] = useState(0.12);

  const isPoster = isPosterCard(pass);

  const update = <K extends keyof PassData>(key: K, value: PassData[K]) => {
    setPass((prev) => ({ ...prev, [key]: value }));
  };

  const changeType = (type: string) => {
    setPass((prev) => ({
      ...prev,
      type,
      style: supportsPosterStyle(type) ? prev.style : "classic",
    }));
  };

  const changeStyle = (style: CardStyle) => {
    setPass((prev) => ({
      ...prev,
      style,
      serial:
        style === "poster" ? (prev.serial ?? createPassSerial()) : prev.serial,
    }));
  };

  return (
    <div className="animate-screen-in flex flex-col gap-7 px-[39px] pt-1 pb-8">
      <section className="flex flex-col gap-3.5">
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-[24px] leading-none font-bold text-white">
            Add a Card
          </h1>
          <button
            type="button"
            onClick={onReset}
            className="text-[13px] font-bold text-[#FF9B5B] active:opacity-70"
          >
            Reset
          </button>
        </div>

        {supportsPosterStyle(pass.type) && (
          <StylePicker value={pass.style ?? "classic"} onChange={changeStyle} />
        )}

        {isPoster ? (
          <button
            type="button"
            onClick={onPosterUpload}
            className="flex w-full items-center justify-between gap-3 rounded-[20px] bg-[#D2D2FF] p-5 text-left active:opacity-90"
          >
            <div className="flex flex-col gap-1 text-[#212121]">
              <span className="text-[18px] leading-none font-bold">
                {pass.posterImage ? "Change Image" : "Upload Poster Image"}
              </span>
              <span className="text-[10px] leading-none">
                Choose a photo and crop it to fit your card
              </span>
            </div>
            <ImagePlus className="size-5 shrink-0 text-[#212121]/60" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onUpload}
              className="flex w-full items-center justify-between rounded-[20px] bg-[#D2D2FF] p-5 text-left active:opacity-90"
            >
              <div className="flex flex-col gap-0.5 text-[#212121]">
                <span className="text-[18px] leading-none font-bold">
                  {uploadedName ? "Image Uploaded" : "Upload Image"}
                </span>
                <span className="text-[10px] leading-none">
                  {uploadedName
                    ? `Tap to replace · ${uploadedName}`
                    : "Barcodes, Loyalty Memberships"}
                </span>
              </div>
              <ChevronRight className="size-5 text-[#212121]/50" />
            </button>

            <button
              type="button"
              onClick={onScan}
              className="flex w-full items-center gap-3 rounded-[20px] border border-white/25 px-4 py-3.5 text-left active:bg-white/5"
            >
              <div className="flex size-9 items-center justify-center rounded-[10px] bg-[#FF9B5B]/20 text-[#FF9B5B]">
                <ScanBarcode className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-white">Scan Barcode</p>
                <p className="text-[11px] text-white/55">
                  Detect code from camera or screenshot
                </p>
              </div>
              <ChevronRight className="size-4 text-white/35" />
            </button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3.5">
        <h2 className="text-[24px] leading-none font-bold text-white">
          Information
        </h2>
        <div className="flex w-full flex-col">
          <InfoRow
            label="Card Name"
            active={activeField === "name"}
            onFocus={() => setActiveField("name")}
          >
            <input
              value={pass.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full bg-transparent text-right text-[12px] leading-none font-normal text-white/80 outline-none"
              placeholder="Card name"
            />
          </InfoRow>
          <InfoRow
            label="Card Type"
            active={activeField === "type"}
            onFocus={() => setActiveField("type")}
          >
            <select
              value={pass.type}
              onChange={(e) => changeType(e.target.value)}
              className="w-full appearance-none bg-transparent text-right text-[12px] leading-none font-normal text-white/80 outline-none"
            >
              {CARD_TYPES.map((type) => (
                <option key={type} value={type} className="bg-[#212121]">
                  {type}
                </option>
              ))}
            </select>
          </InfoRow>
          <InfoRow
            label="Expiry"
            active={activeField === "expiry"}
            onFocus={() => setActiveField("expiry")}
          >
            <input
              value={pass.expiry}
              onChange={(e) => update("expiry", e.target.value)}
              className="w-full bg-transparent text-right text-[12px] leading-none font-normal text-white/80 outline-none"
              placeholder="Dec 2026"
            />
          </InfoRow>
          {!isPoster && (
            <>
              <InfoRow
                label="Barcode"
                active={activeField === "barcode"}
                onFocus={() => setActiveField("barcode")}
              >
                <input
                  value={pass.barcode}
                  onChange={(e) =>
                    setPass((prev) => ({
                      ...prev,
                      barcode: e.target.value,
                      stripImage: undefined,
                    }))
                  }
                  className="w-full bg-transparent text-right text-[12px] leading-none font-normal text-white/80 outline-none placeholder:text-white/40"
                  placeholder={
                    pass.stripImage ? "Using your image" : "Number on your card"
                  }
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </InfoRow>
              <InfoRow
                label="Format"
                active={activeField === "barcodeFormat"}
                onFocus={() => setActiveField("barcodeFormat")}
              >
                <select
                  value={pass.barcodeFormat}
                  onChange={(e) =>
                    update("barcodeFormat", e.target.value as BarcodeFormat)
                  }
                  className="w-full appearance-none bg-transparent text-right text-[12px] leading-none font-normal text-white/80 outline-none"
                >
                  {BARCODE_FORMATS.map((format) => (
                    <option
                      key={format}
                      value={format}
                      className="bg-[#212121]"
                    >
                      {BARCODE_FORMAT_LABELS[format]}
                    </option>
                  ))}
                </select>
              </InfoRow>
            </>
          )}
        </div>
      </section>

      {!isPoster && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-end justify-between">
            <h2 className="text-[24px] leading-none font-bold text-white">
              Color
            </h2>
            <span
              className="size-4 rounded-full border border-white/30"
              style={{ backgroundColor: pass.color }}
            />
          </div>
          <ColorSlider
            value={slider}
            onChange={(position) => {
              setSlider(position);
              update("color", colorFromSlider(position));
            }}
          />
        </section>
      )}

      <section className="flex flex-col items-center gap-4">
        <h2 className="w-full text-center text-[24px] leading-none font-bold text-white">
          Your Card
        </h2>
        <WalletCard pass={pass} className="w-full max-w-[309px]" />

        <div className="flex w-full flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={onAddToWallet}
            disabled={addingToWallet}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-black text-[16px] font-bold text-white ring-1 ring-white/15 active:opacity-80 disabled:opacity-60"
          >
            <Wallet className="size-4" />
            {addingToWallet ? "Creating Pass…" : "Add to Apple Wallet"}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex h-[46px] w-full items-center justify-center rounded-[14px] bg-[#FF9B5B] text-[15px] font-bold text-[#212121] active:opacity-90"
          >
            Save to My Wallet
          </button>
        </div>
      </section>
    </div>
  );
}

function PassesScreen({
  passes,
  editing,
  query,
  onQueryChange,
  onToggleEdit,
  onAdd,
  onOpen,
  onDelete,
}: {
  passes: PassData[];
  editing: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onToggleEdit: () => void;
  onAdd: () => void;
  onOpen: (pass: PassData) => void;
  onDelete: (id: string) => void;
}) {
  const filtered = passes.filter((pass) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      pass.name.toLowerCase().includes(q) || pass.type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-screen-in flex flex-col gap-5 px-[39px] pt-1 pb-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[24px] leading-none font-bold text-white">
          Manage Wallet
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleEdit}
            className="text-[13px] font-bold text-[#FF9B5B] active:opacity-70"
          >
            {editing ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="flex size-7 items-center justify-center rounded-full bg-[#FF9B5B] text-[#212121] active:opacity-80"
            aria-label="Add card"
          >
            <Plus className="size-4" strokeWidth={2.75} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-[14px] bg-white/8 px-3 py-2.5 ring-1 ring-white/10">
        <Search className="size-4 text-white/40" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search cards"
          className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")}>
            <X className="size-4 text-white/40" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-white/20 px-5 py-10 text-center">
          <p className="text-[16px] font-bold text-white">No cards yet</p>
          <p className="mt-1 text-[12px] text-white/50">
            Upload a screenshot to create your first pass.
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-[12px] bg-[#D2D2FF] px-4 text-[13px] font-bold text-[#212121]"
          >
            Add a Card
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-[11px]">
          {filtered.map((pass) => (
            <div key={pass.id} className="flex items-stretch gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => onDelete(pass.id)}
                  className="flex w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#FF3B30] text-white active:opacity-80"
                  aria-label={`Delete ${pass.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpen(pass)}
                className="flex min-w-0 flex-1 items-stretch overflow-hidden active:opacity-90"
              >
                <div
                  className="flex w-[39px] shrink-0 items-center justify-center"
                  style={{ backgroundColor: pass.color }}
                >
                  <div
                    className="size-[11px] rounded-full"
                    style={{ backgroundColor: darkenHex(pass.color, 0.28) }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 bg-white p-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5 text-left text-[#212121]">
                    <p className="truncate text-[12px] leading-none font-bold">
                      {pass.name}
                    </p>
                    <p className="truncate text-[10px] leading-none font-normal text-[#212121]/70">
                      {pass.type} · Added on {pass.addedOn}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-[#212121]/30" />
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailSheet({
  pass,
  addingToWallet,
  onClose,
  onEdit,
  onAddToWallet,
  onDelete,
}: {
  pass: PassData;
  addingToWallet: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddToWallet: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/55 backdrop-blur-[2px]">
      <button
        type="button"
        className="flex-1"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="animate-screen-in rounded-t-[28px] bg-[#212121] px-6 pt-3 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[20px] font-bold text-white">{pass.name}</p>
            <p className="mt-1 text-[12px] text-white/55">
              {pass.type} · Expires {pass.expiry}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <WalletCard pass={pass} className="mx-auto mb-5 max-w-[280px]" />

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onAddToWallet}
            disabled={addingToWallet}
            className="flex h-[48px] items-center justify-center gap-2 rounded-[14px] bg-black text-[15px] font-bold text-white ring-1 ring-white/15 disabled:opacity-60"
          >
            <Wallet className="size-4" />
            {addingToWallet ? "Creating Pass…" : "Add to Apple Wallet"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex h-[44px] items-center justify-center rounded-[14px] bg-[#D2D2FF] text-[14px] font-bold text-[#212121]"
          >
            Edit Card
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-[44px] items-center justify-center gap-2 rounded-[14px] text-[14px] font-bold text-[#FF3B30]"
          >
            <Trash2 className="size-4" />
            Delete Card
          </button>
        </div>
      </div>
    </div>
  );
}

export function IosApp() {
  const [tab, setTab] = useState<Tab>("create");
  const [pass, setPass] = useState<PassData>(DEFAULT_PASS);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [addingToWallet, setAddingToWallet] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [posterSource, setPosterSource] = useState<PosterSource | null>(null);
  const [saved, setSaved] = useState<PassData[]>(EXAMPLE_PASSES);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selected, setSelected] = useState<PassData | null>(null);
  const toastTimer = useRef<number | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);
  const posterUrls = useRef(new Set<string>());

  const showToast = (message: string, tone: ToastState["tone"] = "success") => {
    setToast({ message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      tone === "error" ? 4000 : 2200,
    );
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Cards share cropped images, so a URL is revoked once no card uses it.
  useEffect(() => {
    const inUse = new Set(
      [pass, selected, ...saved].flatMap((card) =>
        card?.posterImageUrl ? [card.posterImageUrl] : [],
      ),
    );
    for (const url of posterUrls.current) {
      if (inUse.has(url)) continue;
      URL.revokeObjectURL(url);
      posterUrls.current.delete(url);
    }
    for (const url of inUse) posterUrls.current.add(url);
  }, [pass, saved, selected]);

  useEffect(() => {
    const urls = posterUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!posterSource) return;
    return () => URL.revokeObjectURL(posterSource.url);
  }, [posterSource]);

  const handlePosterFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPosterSource(await loadPosterSource(file));
    } catch (error) {
      showToast(
        error instanceof PosterImageReadError
          ? error.message
          : "That image couldn't be read.",
        "error",
      );
    }
  };

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadedName(file.name);

    try {
      const scanned = await scanBarcodeFromFile(file);
      if (!scanned.unsupportedFormat) {
        setPass((prev) => ({
          ...prev,
          barcode: scanned.value,
          barcodeFormat: scanned.format,
          stripImage: undefined,
        }));
        showToast("Barcode detected");
        return;
      }
    } catch {
      // Unreadable codes fall through to showing the image itself.
    }
    setCropImageUrl(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
    setCropImageUrl(null);
  };

  const handleSave = () => {
    const isPoster = isPosterCard(pass);
    if (isPoster && !pass.posterImage) {
      showToast("Add an image first", "error");
      return;
    }
    if (!isPoster && !pass.barcode.trim() && !pass.stripImage) {
      showToast("Add your card's barcode first", "error");
      return;
    }

    const card: PassData = isPoster
      ? { ...pass, barcode: "", stripImage: undefined }
      : { ...pass, posterImage: undefined, posterImageUrl: undefined };

    if (saved.find((item) => item.id === pass.id)?.style === "poster") {
      // Editing a Poster card updates it so its Wallet serial stays unique.
      setSaved((prev) =>
        prev.map((item) =>
          item.id === pass.id ? { ...card, addedOn: item.addedOn } : item,
        ),
      );
    } else {
      const next: PassData = {
        ...card,
        id: `saved-${Date.now()}`,
        addedOn: formatAddedOn(),
      };
      setSaved((prev) => [next, ...prev]);
      // The next Poster made from this draft must not replace the saved card.
      if (isPoster) {
        setPass((prev) => ({ ...prev, serial: createPassSerial() }));
      }
    }
    showToast("Saved to Wallet");
    setTab("passes");
  };

  const addPosterToWallet = async (card: PassData) => {
    if (!card.posterImage) {
      showToast("Add an image first", "error");
      return;
    }

    const body = new FormData();
    body.append("name", card.name);
    body.append("type", card.type);
    body.append("expiry", card.expiry);
    body.append("serial", card.serial ?? "");
    body.append("image", card.posterImage, "poster.jpg");

    setAddingToWallet(true);
    try {
      const response = await fetch("/api/pass/poster", {
        method: "POST",
        body,
      });
      const result = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.url) {
        showToast(result?.error ?? "Couldn't create the pass", "error");
        return;
      }
      // Safari only opens the Add to Wallet sheet for a real navigation.
      window.location.assign(result.url);
    } catch {
      showToast("Couldn't reach the server. Try again.", "error");
    } finally {
      setAddingToWallet(false);
    }
  };

  const handleAddToWallet = async (card: PassData) => {
    if (isPosterCard(card)) {
      await addPosterToWallet(card);
      return;
    }
    if (!card.barcode.trim() && !card.stripImage) {
      showToast("Add your card's barcode first", "error");
      return;
    }

    const fields: Record<string, string> = {
      name: card.name,
      type: card.type,
      expiry: card.expiry,
      color: card.color,
      barcode: card.barcode,
      barcodeFormat: card.barcodeFormat,
    };
    const url = `/api/pass?${new URLSearchParams(fields)}`;
    const imageFields = card.stripImage
      ? { ...fields, stripImage: card.stripImage }
      : null;

    setAddingToWallet(true);
    try {
      // Check first so a failure shows here instead of replacing the app page.
      let body: FormData | undefined;
      if (imageFields) {
        body = new FormData();
        for (const [key, value] of Object.entries(imageFields)) {
          body.append(key, value);
        }
      }
      const response = await fetch(
        imageFields ? "/api/pass" : url,
        imageFields ? { method: "POST", body } : undefined,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        showToast(body?.error ?? "Couldn't create the pass", "error");
        return;
      }
      // Safari only opens the Add to Wallet sheet for a real navigation.
      if (imageFields) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/pass";
        form.enctype = "multipart/form-data";
        form.hidden = true;
        for (const [key, value] of Object.entries(imageFields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          form.append(input);
        }
        document.body.append(form);
        form.submit();
        form.remove();
      } else {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- this is a file download, not a page
        window.location.assign(url);
      }
    } catch {
      showToast("Couldn't reach the server. Try again.", "error");
    } finally {
      setAddingToWallet(false);
    }
  };

  const handleReset = () => {
    setPass(DEFAULT_PASS);
    setUploadedName(null);
    showToast("Draft cleared");
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black p-0 sm:p-8">
      <div
        className={cn(
          "relative flex h-dvh w-full flex-col overflow-hidden bg-[#212121]",
          "sm:h-[844px] sm:w-[390px] sm:rounded-[52px] sm:border-[10px] sm:border-[#1c1c1e]",
          "sm:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.65)]",
        )}
      >
        <div className="pointer-events-none absolute inset-0 z-40 hidden rounded-[42px] ring-1 ring-white/10 sm:block" />

        <StatusBar />
        <Toast toast={toast} />

        <input
          ref={uploadInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload a barcode image"
          onChange={(e) => {
            void handleImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Take a photo of a barcode"
          onChange={(e) => {
            void handleImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={posterInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload a poster image"
          onChange={(e) => {
            void handlePosterFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tab === "create" ? (
            <CreateScreen
              pass={pass}
              setPass={setPass}
              uploadedName={uploadedName}
              addingToWallet={addingToWallet}
              onUpload={() => uploadInput.current?.click()}
              onPosterUpload={() => posterInput.current?.click()}
              onScan={() => cameraInput.current?.click()}
              onSave={handleSave}
              onAddToWallet={() => void handleAddToWallet(pass)}
              onReset={handleReset}
            />
          ) : (
            <PassesScreen
              passes={saved}
              editing={editing}
              query={query}
              onQueryChange={setQuery}
              onToggleEdit={() => setEditing((v) => !v)}
              onAdd={() => setTab("create")}
              onOpen={setSelected}
              onDelete={(id) => {
                setSaved((prev) => prev.filter((p) => p.id !== id));
                showToast("Card deleted");
              }}
            />
          )}
        </div>

        <TabBar tab={tab} onChange={setTab} />

        {cropImageUrl && (
          <CropSheet
            imageUrl={cropImageUrl}
            onCancel={closeCrop}
            onApply={(stripImage) => {
              setPass((prev) => ({ ...prev, barcode: "", stripImage }));
              closeCrop();
              showToast("Image added to your card");
            }}
          />
        )}

        {posterSource && (
          <PosterCropSheet
            key={posterSource.url}
            source={posterSource}
            onCancel={() => setPosterSource(null)}
            onApply={(posterImage) => {
              const posterImageUrl = URL.createObjectURL(posterImage);
              setPass((prev) => ({ ...prev, posterImage, posterImageUrl }));
              setPosterSource(null);
              showToast("Image added to your card");
            }}
          />
        )}

        {selected && (
          <DetailSheet
            pass={selected}
            addingToWallet={addingToWallet}
            onClose={() => setSelected(null)}
            onEdit={() => {
              setPass(selected);
              setUploadedName(null);
              setSelected(null);
              setTab("create");
            }}
            onAddToWallet={() => void handleAddToWallet(selected)}
            onDelete={() => {
              setSaved((prev) => prev.filter((p) => p.id !== selected.id));
              setSelected(null);
              showToast("Card deleted");
            }}
          />
        )}
      </div>
    </div>
  );
}
