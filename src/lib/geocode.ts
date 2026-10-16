import "server-only";

export type GeocodeStatus = "verified" | "needs_review" | "not_found" | "test_data";

export type GeocodeOutcome = {
  status: GeocodeStatus;
  lat: number | null;
  lng: number | null;
  formattedAddress: string | null;
  locationType: string | null;
  placeId: string | null;
  neighborhood: string | null;
  partialMatch: boolean | null;
  provider: "google" | "test";
  raw: unknown;
  note?: string;
};

type GComponent = { long_name: string; types: string[] };
type GResult = {
  formatted_address: string;
  place_id: string;
  partial_match?: boolean;
  address_components: GComponent[];
  geometry: { location: { lat: number; lng: number }; location_type: string };
};

// Neighborhood exactly as Google returns it; null when Google gives none (we never guess).
export function neighborhoodOf(r: GResult): string | null {
  const pick = (t: string) => r.address_components.find((c) => c.types.includes(t))?.long_name ?? null;
  return pick("neighborhood") ?? pick("sublocality_level_1") ?? pick("sublocality") ?? null;
}

export function classify(r: GResult, wantedNumber: string | null): GeocodeStatus {
  const hasNumber = r.address_components.some((c) => c.types.includes("street_number"));
  const exact = r.geometry.location_type === "ROOFTOP" || r.geometry.location_type === "RANGE_INTERPOLATED";
  if (!r.partial_match && exact && (hasNumber || !wantedNumber)) return "verified";
  return "needs_review";
}

export async function geocodeAddress(a: {
  street: string | null;
  houseNumber: string | null;
  city: string | null;
}): Promise<GeocodeOutcome> {
  const empty = { lat: null, lng: null, formattedAddress: null, locationType: null, placeId: null, neighborhood: null, partialMatch: null };
  if (!a.street) return { ...empty, status: "not_found", provider: "google", raw: null, note: "אין שם רחוב לבדיקה" };

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    // Test mode: clearly labelled, no coordinates or neighborhood are made up.
    return { ...empty, status: "test_data", provider: "test", raw: null, note: "מצב בדיקה — לא הוגדר מפתח Google, הכתובת לא נבדקה" };
  }

  const city = a.city || "חדרה";
  const params = new URLSearchParams({
    address: `${a.street} ${a.houseNumber ?? ""}, ${city}`.replace(/\s+/g, " ").trim(),
    components: "country:IL",
    language: "iw",
    region: "il",
    key,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { cache: "no-store" });
  const json = (await res.json()) as { status: string; results: GResult[]; error_message?: string };

  if (json.status === "ZERO_RESULTS") return { ...empty, status: "not_found", provider: "google", raw: json };
  if (json.status !== "OK") {
    return { ...empty, status: "needs_review", provider: "google", raw: json, note: `שגיאת Google: ${json.status} ${json.error_message ?? ""}`.trim() };
  }

  // Prefer a result inside the requested city; several candidates → user must confirm.
  const inCity = json.results.filter((r) => r.address_components.some((c) => c.types.includes("locality") && c.long_name.includes(city.split(/[ -]/)[0])));
  const candidates = inCity.length ? inCity : json.results;
  const best = candidates[0];
  let status = classify(best, a.houseNumber);
  if (candidates.length > 1 || !inCity.length) status = "needs_review";

  return {
    status,
    lat: best.geometry.location.lat,
    lng: best.geometry.location.lng,
    formattedAddress: best.formatted_address,
    locationType: best.geometry.location_type,
    placeId: best.place_id,
    neighborhood: neighborhoodOf(best),
    partialMatch: best.partial_match ?? false,
    provider: "google",
    raw: json,
    note: !inCity.length ? `התוצאה לא נמצאת ב${city}` : candidates.length > 1 ? "נמצאו כמה התאמות" : undefined,
  };
}
