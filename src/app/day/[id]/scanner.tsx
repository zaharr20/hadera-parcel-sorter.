"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseLabel, type ParsedLabel } from "@/lib/parse-label";

type Phase = "idle" | "reading" | "review" | "saving";

const LABELS: Record<keyof ParsedLabel, string> = {
  street: "רחוב",
  houseNumber: "מספר בית",
  apartment: "דירה",
  city: "עיר",
  zip: "מיקוד",
  trackingNumber: "מספר מעקב",
};

const EMPTY: ParsedLabel = { street: null, houseNumber: null, apartment: null, city: null, zip: null, trackingNumber: null };

// Shrink the photo before OCR and upload: faster on the phone, smaller storage.
async function toJpeg(file: File, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export default function Scanner({ dayId, defaultCity }: { dayId: string; defaultCity: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [parsed, setParsed] = useState<ParsedLabel>(EMPTY);
  const [fields, setFields] = useState<ParsedLabel>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setPhase("reading");
    setProgress(0);
    const jpeg = await toJpeg(file);
    setImage(jpeg);
    setPreview(URL.createObjectURL(jpeg));

    // OCR runs in the browser; the photo is not sent to any OCR service.
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(["heb", "eng"], 1, {
      logger: (m) => m.status === "recognizing text" && setProgress(Math.round(m.progress * 100)),
    });
    const { data } = await worker.recognize(jpeg);
    await worker.terminate();

    const p = parseLabel(data.text);
    setOcrText(data.text);
    setParsed(p);
    setFields({ ...p, city: p.city ?? defaultCity });
    setPhase("review");
  }

  async function save() {
    setPhase("saving");
    const fd = new FormData();
    if (image) fd.append("image", image, "label.jpg");
    fd.append("ocrText", ocrText);
    fd.append("ocrEngine", "tesseract.js-heb");
    fd.append("parsed", JSON.stringify(parsed));
    (Object.keys(fields) as (keyof ParsedLabel)[]).forEach((k) => fd.append(k, fields[k] ?? ""));

    const res = await fetch(`/api/days/${dayId}/parcels`, { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "השמירה נכשלה");
      setPhase("review");
      return;
    }
    setMessage(json.duplicate ? `החבילה כבר נסרקה (מס׳ ${json.parcel.seq}) — לא נוספה שוב` : `נשמרה חבילה מס׳ ${json.parcel.seq}`);
    reset();
    router.refresh();
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setImage(null);
    setFields(EMPTY);
    setParsed(EMPTY);
    setOcrText("");
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {message && <p className="rounded-lg bg-emerald-100 p-3 text-emerald-900">{message}</p>}

      {phase === "idle" && (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl bg-blue-600 py-6 text-xl font-bold text-white active:bg-blue-700"
        >
          צלם מדבקה
        </button>
      )}

      {phase === "reading" && (
        <p className="rounded-lg bg-white p-4 text-center shadow-sm">קורא את המדבקה… {progress}%</p>
      )}

      {(phase === "review" || phase === "saving") && (
        <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="המדבקה שצולמה" className="max-h-48 w-full rounded-lg object-contain bg-neutral-100" />
          )}
          <p className="text-sm text-neutral-500">בדוק ותקן לפני השמירה. אפשר לשמור גם עם שדות ריקים.</p>

          {(Object.keys(LABELS) as (keyof ParsedLabel)[]).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{LABELS[k]}</span>
              <input
                value={fields[k] ?? ""}
                onChange={(e) => setFields({ ...fields, [k]: e.target.value || null })}
                dir={k === "trackingNumber" ? "ltr" : undefined}
                inputMode={k === "houseNumber" || k === "apartment" || k === "zip" ? "numeric" : undefined}
                className="rounded-lg border border-neutral-300 px-3 py-3 text-lg"
              />
            </label>
          ))}

          <details className="text-sm text-neutral-500">
            <summary>הטקסט שזוהה</summary>
            <pre className="whitespace-pre-wrap" dir="auto">{ocrText || "(לא זוהה טקסט)"}</pre>
          </details>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={phase === "saving"}
              className="flex-1 rounded-xl bg-blue-600 py-4 text-lg font-bold text-white disabled:opacity-50"
            >
              {phase === "saving" ? "שומר…" : "שמור"}
            </button>
            <button onClick={reset} className="rounded-xl border border-neutral-300 px-5 py-4 text-lg">
              צלם שוב
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
