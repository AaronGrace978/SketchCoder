import Link from "next/link";
import { HeroCanvas } from "@/components/landing/HeroCanvas";

export default function HomePage() {
  return (
    <main className="bg-ink text-bone">
      <section className="relative h-screen min-h-[640px] overflow-hidden">
        <HeroCanvas />
        <div className="pointer-events-none absolute inset-0 bg-ink/35" />
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-8 pt-8 md:px-12 md:pt-10">
          <div>
            <h1 className="text-[clamp(40px,6vw,84px)] leading-[0.92] tracking-[-0.045em]">
              SketchCoder
            </h1>
            <p className="mt-3 max-w-md text-[18px] leading-snug text-muted md:text-[20px]">
              Spell it. Screenshot it. The agent codes it.
            </p>
          </div>
          <Link
            href="/studio"
            className="pointer-events-auto mt-2 bg-brass px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink"
          >
            Open Studio
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-8 py-28 md:px-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">How it works</p>
        <h2 className="mt-3 max-w-2xl text-[clamp(28px,4vw,44px)] leading-[1.05] tracking-[-0.035em]">
          Spell the system. We screenshot it and code it.
        </h2>
        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {[
            {
              n: "01",
              t: "Spell or sketch",
              d: "Write RAG with the pen, or draw boxes and arrows. The board is the prompt.",
            },
            {
              n: "02",
              t: "Screenshot",
              d: "Generate captures the board. Vision reads the handwriting and the diagram.",
            },
            {
              n: "03",
              t: "Scaffold",
              d: "The agent materializes the system graph, then streams runnable files into the rail.",
            },
          ].map((step) => (
            <li key={step.n}>
              <p className="font-mono text-[11px] text-brass">{step.n}</p>
              <h3 className="mt-3 text-[26px] tracking-[-0.03em]">{step.t}</h3>
              <p className="mt-3 text-[16px] leading-relaxed text-muted">{step.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-5xl gap-16 px-8 py-28 md:grid-cols-[1.1fr_0.9fr] md:px-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              The RAG story
            </p>
            <h2 className="mt-3 text-[clamp(28px,4vw,44px)] leading-[1.05] tracking-[-0.035em]">
              Retrieval, then the model, then the API.
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
              Spell RAG on the board and hit Generate — we screenshot the ink, recognize the word,
              expand it into the full pipeline, and stream a runnable scaffold. Or load the canned
              diagram and refine with the mouse.
            </p>
            <Link
              href="/studio?demo=rag"
              className="mt-10 inline-block border border-brass px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-brass"
            >
              Open the RAG sketch
            </Link>
          </div>
          <div className="border border-line bg-graphite p-6 font-mono text-[12px] leading-7 text-muted">
            <p className="text-bone">corpus → embed → vector store</p>
            <p>chat UI → ask API → retriever</p>
            <p>retriever → grounded LLM → stream</p>
            <p className="mt-6 text-brass">output / src/lib/retriever.ts</p>
            <p>output / src/lib/llm.ts</p>
            <p>output / src/server.ts</p>
          </div>
        </div>
      </section>

      <section className="border-t border-line px-8 py-24 text-center md:px-12">
        <p className="text-[clamp(28px,4vw,48px)] tracking-[-0.04em]">Mouse as IDE.</p>
        <Link
          href="/studio"
          className="mt-8 inline-block bg-brass px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink"
        >
          Open Studio
        </Link>
      </section>
    </main>
  );
}
