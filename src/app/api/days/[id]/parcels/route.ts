import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { geocodeAddress } from "@/lib/geocode";

const FIELDS = ["street", "houseNumber", "apartment", "city", "zip", "trackingNumber"] as const;
type Field = (typeof FIELDS)[number];

function val(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: dayId } = await params;
  const db = supabaseServer();
  const fd = await request.formData();

  const fields = Object.fromEntries(FIELDS.map((f) => [f, val(fd, f)])) as Record<Field, string | null>;
  let parsed: Partial<Record<Field, string | null>> = {};
  try { parsed = JSON.parse(val(fd, "parsed") ?? "{}"); } catch {}

  // Same tracking number scanned twice on the same day → return the existing parcel, no new row.
  if (fields.trackingNumber) {
    const { data: existing } = await db
      .from("parcels")
      .select("id, seq")
      .eq("delivery_day_id", dayId)
      .eq("tracking_number", fields.trackingNumber)
      .maybeSingle();
    if (existing) return NextResponse.json({ duplicate: true, parcel: existing });
  }

  let imagePath: string | null = null;
  const image = fd.get("image");
  if (image instanceof File && image.size > 0) {
    imagePath = `${dayId}/${crypto.randomUUID()}.jpg`;
    const { error } = await db.storage.from("labels").upload(imagePath, image, { contentType: "image/jpeg" });
    if (error) return NextResponse.json({ error: `שמירת התמונה נכשלה: ${error.message}` }, { status: 500 });
  }

  const { data: address, error: addrErr } = await db
    .from("addresses")
    .insert({
      raw_text: val(fd, "ocrText"),
      street: fields.street,
      house_number: fields.houseNumber,
      apartment: fields.apartment,
      city: fields.city,
      zip: fields.zip,
    })
    .select("id")
    .single();
  if (addrErr) return NextResponse.json({ error: addrErr.message }, { status: 500 });

  const { data: last } = await db
    .from("parcels")
    .select("seq")
    .eq("delivery_day_id", dayId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  const corrected = FIELDS.some((f) => (parsed[f] ?? null) !== fields[f]);

  const { data: parcel, error: parcelErr } = await db
    .from("parcels")
    .insert({
      delivery_day_id: dayId,
      seq: (last?.seq ?? 0) + 1,
      tracking_number: fields.trackingNumber,
      address_id: address.id,
      image_path: imagePath,
      ocr_text: val(fd, "ocrText"),
      ocr_engine: val(fd, "ocrEngine"),
      status: corrected ? "corrected" : "scanned",
    })
    .select("id, seq")
    .single();
  if (parcelErr) return NextResponse.json({ error: parcelErr.message }, { status: 500 });

  const corrections = FIELDS.filter((f) => (parsed[f] ?? null) !== fields[f]).map((f) => ({
    parcel_id: parcel.id,
    field: f,
    old_value: parsed[f] ?? null,
    new_value: fields[f],
  }));
  if (corrections.length) await db.from("user_corrections").insert(corrections);

  // Look the address up and keep the neighborhood exactly as the provider returned it.
  const geo = await geocodeAddress({ street: fields.street, houseNumber: fields.houseNumber, city: fields.city });
  await db.from("geocode_results").insert({
    address_id: address.id,
    status: geo.status,
    lat: geo.lat,
    lng: geo.lng,
    formatted_address: geo.formattedAddress,
    location_type: geo.locationType,
    provider: geo.provider,
    place_id: geo.placeId,
    neighborhood: geo.neighborhood,
    neighborhood_source: geo.neighborhood ? geo.provider : null,
    partial_match: geo.partialMatch,
    raw_response: geo.raw,
  });
  if (geo.status === "verified") await db.from("parcels").update({ status: "verified" }).eq("id", parcel.id);

  const { count } = await db
    .from("parcels")
    .select("id", { count: "exact", head: true })
    .eq("delivery_day_id", dayId);

  return NextResponse.json({
    duplicate: false,
    parcel,
    geo: { status: geo.status, neighborhood: geo.neighborhood, formattedAddress: geo.formattedAddress, note: geo.note ?? null },
    dayCount: count ?? null,
  });
}
