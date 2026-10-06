"use client";

import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "../convex/_generated/api";

export default function Home() {
  const analyzePr = useAction(api.briefs.analyzePr);
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const changeModelId = await analyzePr({ url: url.trim() });
      router.push(`/brief/${changeModelId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze that PR.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[var(--measure)] p-[var(--pad-screen)]">
      <p className="font-display text-[1.35rem] mb-2">Dekko</p>
      <h1 className="font-display text-[var(--text-question)] font-normal leading-snug m-0 mb-2">
        Paste a pull request URL
      </h1>
      <p className="text-muted text-[0.88rem] m-0 mb-6">
        We read the diff and build a brief. Usually 10–40 seconds.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          disabled={pending}
          className="w-full rounded-md border border-line bg-field text-ink px-[0.95rem] py-[0.75rem] font-sans"
        />
        <button
          type="submit"
          disabled={pending || url.trim().length === 0}
          className="inline-flex items-center self-start rounded-btn bg-accent text-accent-ink font-semibold text-[0.9rem] px-[1.1rem] py-[0.6rem] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Analyze
        </button>
        {pending ? (
          <p className="text-muted text-[0.88rem] m-0" role="status">
            Reading the diff and asking the model. Usually 10–40 seconds.
          </p>
        ) : null}
        {error ? (
          <p className="text-bad text-[0.88rem] m-0" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
