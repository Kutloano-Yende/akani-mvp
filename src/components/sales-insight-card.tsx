export type SalesInsight = {
  text: string;
  tone?: "action" | "warning" | "positive";
};

const TONE_DOT: Record<NonNullable<SalesInsight["tone"]>, string> = {
  action: "bg-akani-gold",
  warning: "bg-akani-warning",
  positive: "bg-akani-success",
};

/**
 * A short list of computed observations about the pipeline — real counts
 * derived from the data, not generated copy. Reads as an insight panel,
 * not a chatbot.
 */
export function SalesInsightCard({ insights }: { insights: SalesInsight[] }) {
  return (
    <div className="rounded-xl border border-akani-card-border bg-gradient-to-br from-akani-navy to-akani-deep-blue p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
            stroke="#ecb100"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 12 11 14l4-4" stroke="#ecb100" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="text-sm font-semibold text-white">Sales Intelligence</h2>
      </div>
      {insights.length === 0 ? (
        <p className="text-sm text-white/60">
          No notable signals right now — check back as more prospects move through the pipeline.
        </p>
      ) : (
        <ul className="space-y-3">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/90">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[insight.tone ?? "action"]}`} />
              {insight.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
