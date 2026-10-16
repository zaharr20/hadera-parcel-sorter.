import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase-server";
import Scanner from "./scanner";

type ParcelRow = {
  id: string;
  seq: number;
  status: string;
  tracking_number: string | null;
  addresses: {
    street: string | null;
    house_number: string | null;
    apartment: string | null;
    city: string | null;
    geocode_results: { status: string; neighborhood: string | null; fetched_at: string }[];
  } | null;
};

const STATUS_TEXT: Record<string, string> = {
  verified: "אומתה",
  needs_review: "דורשת בדיקה",
  not_found: "לא נמצאה",
  test_data: "מצב בדיקה",
};

function latestGeo(p: ParcelRow) {
  const list = p.addresses?.geocode_results ?? [];
  return [...list].sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))[0] ?? null;
}

export default function DayPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="p-4 text-neutral-500">טוען…</main>}>
      <DayContent params={params} />
    </Suspense>
  );
}

async function DayContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let db;
  try {
    db = supabaseServer();
  } catch (e) {
    return <main className="p-4"><p className="rounded-lg bg-red-100 p-3 text-red-900">{(e as Error).message}</p></main>;
  }

  const { data: day, error: dayErr } = await db.from("delivery_days").select("id, day_date, default_city").eq("id", id).maybeSingle();
  if (dayErr) {
    return <main className="p-4"><p className="rounded-lg bg-red-100 p-3 text-red-900">שגיאת מסד נתונים: {dayErr.message}</p></main>;
  }
  if (!day) notFound();

  const { data } = await db
    .from("parcels")
    .select("id, seq, status, tracking_number, addresses(street, house_number, apartment, city, geocode_results(status, neighborhood, fetched_at))")
    .eq("delivery_day_id", id)
    .order("seq", { ascending: false });
  const parcels = (data as unknown as ParcelRow[]) ?? [];
  const pending = parcels.filter((p) => p.status === "scanned" || p.status === "corrected").length;

  // Group by neighborhood (as returned by the address lookup), then by street and house number.
  const byHood = new Map<string, ParcelRow[]>();
  for (const p of parcels) {
    const hood = latestGeo(p)?.neighborhood ?? "שכונה לא ידועה";
    byHood.set(hood, [...(byHood.get(hood) ?? []), p]);
  }
  const groups = [...byHood.entries()]
    .map(([hood, items]) => [
      hood,
      items.sort(
        (x, y) =>
          (x.addresses?.street ?? "").localeCompare(y.addresses?.street ?? "", "he") ||
          (parseInt(x.addresses?.house_number ?? "0") || 0) - (parseInt(y.addresses?.house_number ?? "0") || 0),
      ),
    ] as const)
    .sort((a, b) => (a[0] === "שכונה לא ידועה" ? 1 : b[0] === "שכונה לא ידועה" ? -1 : b[1].length - a[1].length));

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">יום חלוקה {day.day_date}</h1>
        <Link href="/" className="text-blue-700">כל הימים</Link>
      </header>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="text-3xl font-bold">{parcels.length}</div>
          <div className="text-sm text-neutral-500">נסרקו</div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="text-3xl font-bold">{pending}</div>
          <div className="text-sm text-neutral-500">טרם אומתו</div>
        </div>
      </div>

      <Scanner dayId={day.id} defaultCity={day.default_city} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">לפי שכונה</h2>
        {parcels.length === 0 && <p className="text-neutral-500">עדיין לא נסרקו חבילות.</p>}
        {groups.map(([hood, items]) => (
          <div key={hood} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-bold">{hood}</span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{items.length} חבילות</span>
            </div>
            <ul className="flex flex-col divide-y divide-neutral-100">
              {items.map((p) => {
                const a = p.addresses;
                const g = latestGeo(p);
                const line = a?.street ? `${a.street} ${a.house_number ?? ""}${a.apartment ? `, דירה ${a.apartment}` : ""}` : "כתובת חסרה";
                return (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <span className="w-8 text-center font-bold text-neutral-400">{p.seq}</span>
                    <span className="flex-1">{line}</span>
                    <span className="text-xs text-neutral-500">{g ? STATUS_TEXT[g.status] ?? g.status : "לא נבדקה"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
