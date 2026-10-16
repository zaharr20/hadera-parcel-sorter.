// Extracts address fields from raw OCR text of a shipping label.
// Heuristic only: every field may be null and the user always reviews before saving.

export type ParsedLabel = {
  street: string | null;
  houseNumber: string | null;
  apartment: string | null;
  city: string | null;
  zip: string | null;
  trackingNumber: string | null;
};

// Cities seen near Hadera. Hadera is the default but is never forced over a city found on the label.
const KNOWN_CITIES = [
  "חדרה", "פרדס חנה-כרכור", "פרדס חנה", "כרכור", "גבעת עדה", "אור עקיבא", "קיסריה",
  "בנימינה", "זכרון יעקב", "נתניה", "חריש", "כפר יונה", "עין שמר", "אליכין",
  "גבעת אולגה", "בית אליעזר", "מכמורת", "קציר", "אום אל-פחם",
];

const STREET_PREFIX = /^(רח(?:וב|'|׳)?|שד(?:רות|'|׳)?|דרך|סמ(?:טת|'|׳)?|כיכר)\s+/;

function clean(s: string) {
  return s.replace(/[|_~`"“”„]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseLabel(raw: string): ParsedLabel {
  const text = raw.replace(/\r/g, "");
  const lines = text.split("\n").map(clean).filter(Boolean);

  // Tracking number: long token with digits, usually Latin letters + digits (e.g. RR123456789IL).
  const tracking =
    text.match(/\b[A-Z]{2}\d{9}[A-Z]{2}\b/)?.[0] ??
    text.match(/\b(?=[A-Z0-9]*\d)[A-Z0-9]{10,24}\b/)?.[0] ??
    null;

  // Israeli zip code: exactly 7 digits, not part of a longer number.
  // Skip phone numbers like 050-1234567 (digits glued to a hyphen).
  const zip = text.match(/(?<![\d-])\d{7}(?![\d-])/)?.[0] ?? null;

  let city: string | null = null;
  for (const c of [...KNOWN_CITIES].sort((a, b) => b.length - a.length)) {
    if (text.includes(c)) { city = c; break; }
  }

  const apartment =
    text.match(/(?:דירה|דיר'|דיר׳|ד׳|ד')\s*[:.]?\s*(\d{1,4})/)?.[1] ?? null;

  // Street + number: Hebrew words followed by a house number (optionally with a letter, e.g. 14א).
  let street: string | null = null;
  let houseNumber: string | null = null;
  for (const line of lines) {
    const withoutApt = line.replace(/(?:דירה|דיר'|דיר׳)\s*[:.]?\s*\d+.*/, "").trim();
    const m = withoutApt.match(/([֐-׿"'׳״\-\s]{2,40}?)\s+(\d{1,4}[א-ו]?)(?:\s*\/\s*\d+)?(?:\s|,|$)/);
    if (!m) continue;
    let candidate = clean(m[1]).replace(STREET_PREFIX, "");
    if (city) candidate = candidate.replace(city, "").trim();
    if (candidate.length < 2 || /^(טל|טלפון|נייד|מיקוד|דירה)/.test(candidate)) continue;
    street = candidate;
    houseNumber = m[2];
    break;
  }

  return { street, houseNumber, apartment, city, zip, trackingNumber: tracking };
}
