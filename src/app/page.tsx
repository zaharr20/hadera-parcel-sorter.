import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase-server";

async function createDay() {
  "use server";
  let id: string | null = null;
  let problem: string | null = null;
  try {
    const { data, error } = await supabaseServer().from("delivery_days").insert({}).select("id").single();
    if (error) problem = `שגיאת מסד נתונים: ${error.message}`;
    else id = data.id;
  } catch (e) {
    problem = (e as Error).message;
  }
  // Production hides thrown errors, so the reason travels in the URL and is shown on screen.
  redirect(id ? `/day/${id}` : `/?error=${encodeURIComponent(problem ?? "שגיאה לא ידועה")}`);
}

async function ErrorBanner({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return error ? <p className="rounded-lg bg-red-100 p-3 text-red-900">{error}</p> : null;
}

type Day = { id: string; day_date: string; default_city: string; parcels: { count: number }[] };

async function DayList() {
  await connection();
  let days: Day[] = [];
  let configError: string | null = null;
  try {
    const { data, error } = await supabaseServer()
      .from("delivery_days")
      .select("id, day_date, default_city, parcels(count)")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) configError = error.message;
    days = (data as Day[]) ?? [];
  } catch (e) {
    configError = (e as Error).message;
  }

  return (
    <>
      {configError && (
        <p className="rounded-lg bg-amber-100 p-3 text-amber-900">{configError}</p>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">ימים אחרונים</h2>
        {days.length === 0 && <p className="text-neutral-500">עדיין אין ימי חלוקה.</p>}
        {days.map((d) => (
          <Link key={d.id} href={`/day/${d.id}`} className="flex justify-between rounded-lg bg-white p-3 shadow-sm active:bg-neutral-100">
            <span>{d.day_date} · {d.default_city}</span>
            <span>{d.parcels?.[0]?.count ?? 0} חבילות</span>
          </Link>
        ))}
      </section>
    </>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">מיון חבילות</h1>
      <Suspense fallback={null}>
        <ErrorBanner searchParams={searchParams} />
      </Suspense>
      <form action={createDay}>
        <button className="w-full rounded-xl bg-blue-600 py-5 text-xl font-bold text-white active:bg-blue-700">
          יום חלוקה חדש
        </button>
      </form>
      <Suspense fallback={<p className="text-neutral-500">טוען…</p>}>
        <DayList />
      </Suspense>
    </main>
  );
}
