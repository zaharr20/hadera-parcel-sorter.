import { Suspense } from "react";

async function ErrorNote({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return error ? <p className="rounded-lg bg-red-100 p-3 text-red-900">סיסמה שגויה, נסה שוב.</p> : null;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">מיון חבילות</h1>
      <Suspense fallback={null}>
        <ErrorNote searchParams={searchParams} />
      </Suspense>
      <form action="/api/login" method="post" className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">סיסמה</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="rounded-lg border border-neutral-300 px-3 py-3 text-lg"
          />
        </label>
        <button className="rounded-xl bg-blue-600 py-4 text-lg font-bold text-white active:bg-blue-700">
          כניסה
        </button>
      </form>
    </main>
  );
}
