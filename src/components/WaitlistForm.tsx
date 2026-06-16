import { useState } from "react";
import { ArrowRight } from "lucide-react";

type Status = "idle" | "loading" | "done" | "error";

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error("bad status");
      if (typeof window !== "undefined" && (window as any).umami) {
        (window as any).umami.track("waitlist_submit");
      }
      setStatus("done");
    } catch {
      // Backend (D1) not provisioned yet — capture via email so no lead is lost.
      const subject = encodeURIComponent("join the gymbo waitlist");
      const body = encodeURIComponent(`name: ${name}\nemail: ${email}`);
      window.location.href = `mailto:hello@getgymbo.com?subject=${subject}&body=${body}`;
      setStatus("done");
    }
  }

  if (status === "done") {
    return (
      <p
        className="text-[15px] py-4"
        style={{ color: "var(--accent)", fontFamily: "var(--font-sans)", fontWeight: 600 }}
      >
        You're on the list — we'll email you when it's your turn.
      </p>
    );
  }

  const field =
    "w-full rounded-xl px-5 h-12 text-[14px] outline-none transition-colors";
  const fieldStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
    fontFamily: "var(--font-sans)",
  } as const;

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[440px] flex flex-col gap-3">
      <input
        type="text"
        name="name"
        autoComplete="name"
        placeholder="your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={field}
        style={fieldStyle}
      />
      <input
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder="your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={field}
        style={fieldStyle}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex items-center justify-center gap-2.5 px-8 h-12 rounded-xl text-[14px] transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
        style={{
          background: "var(--accent)",
          color: "var(--accent-foreground)",
          fontWeight: 600,
          fontFamily: "var(--font-sans)",
        }}
      >
        {status === "loading" ? "joining…" : "Get gymbo"}
        {status !== "loading" && <ArrowRight size={16} aria-hidden="true" />}
      </button>
      {status === "error" && (
        <span className="text-[13px] text-white/60">
          something went wrong — please message us on WhatsApp below.
        </span>
      )}
    </form>
  );
}
