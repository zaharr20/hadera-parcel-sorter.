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
  addresses: { street: string | null; house_number: string | null; apartment: string | null; city: string | null } | null;
};

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
    .select("id, seq, status, tracking_number, addresses(street, house_number, apartment, city)")
    .eq("delivery_day_id", id)
    .order("seq", { ascending: false });
  const parcels = (data as unknown as ParcelRow[]) ?? [];
  const pending = parcels.filter((p) => p.status === "scanned" || p.status === "corrected").length;

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

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">חבילות שנסרקו</h2>
        {parcels.length === 0 && <p className="text-neutral-500">עדיין לא נסרקו חבילות.</p>}
        {parcels.map((p) => {
          const a = p.addresses;
          const line = a?.street ? `${a.street} ${a.house_number ?? ""}${a.apartment ? `, דירה ${a.apartment}` : ""}` : "כתובת חסרה";
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
              <span className="w-8 text-center font-bold text-neutral-400">{p.seq}</span>
              <div className="flex-1">
                <div className="font-medium">{line}</div>
                <div className="text-sm text-neutral-500">{a?.city ?? "עיר לא ידועה"} · לא אומתה עדיין</div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
