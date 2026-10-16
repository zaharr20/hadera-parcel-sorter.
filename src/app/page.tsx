import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function createDay() {
  "use server";
  const { data, error } = await supabaseServer().from("delivery_days").insert({}).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/day/${data.id}`);
}

type Day = { id: string; day_date: string; default_city: string; parcels: { count: number }[] };

export default async function Home() {
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
    <main className="mx-auto w-full max-w-md flex-1 p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">מיון חבילות</h1>

      {configError && (
        <p className="rounded-lg bg-amber-100 p-3 text-amber-900">{configError}</p>
      )}

      <form action={createDay}>
        <button className="w-full rounded-xl bg-blue-600 py-5 text-xl font-bold text-white active:bg-blue-700">
          יום חלוקה חדש
        </button>
      </form>

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
    </main>
  );
}
