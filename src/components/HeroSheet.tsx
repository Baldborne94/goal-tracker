"use client";

// La Scheda dell'Eroe: il pentagono delle cinque statistiche, la classe
// emergente e il registro dei punti. Solo presentazione — le regole vivono
// in src/lib/hero-stats.ts, i dati arrivano dal server via ProfileClient.

import {
  STATS,
  computeHeroClass,
  scoreFromPoints,
  BASE_SCORE,
  MAX_SCORE,
  type StatKey,
  type StatTotals,
} from "@/lib/hero-stats";

export type HeroSheetEvent = {
  id: string;
  stat: StatKey;
  points: number;
  label: string;
  date: string;
};

function shortDate(date: string): string {
  const d = new Date(date + "T12:00:00");
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

/** Pentagono radar: un vertice per stat, raggio proporzionale al punteggio. */
function Radar({ totals }: { totals: StatTotals }) {
  const cx = 110, cy = 100, rMin = 14, rMax = 72, rLabel = 88;

  const point = (i: number, r: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const ringAt = (score: number) =>
    STATS.map((_, i) => point(i, rMin + ((score - BASE_SCORE) / (MAX_SCORE - BASE_SCORE)) * (rMax - rMin)))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

  const values = STATS.map((s, i) => {
    const { score } = scoreFromPoints(totals[s.key]);
    const r = rMin + ((score - BASE_SCORE) / (MAX_SCORE - BASE_SCORE)) * (rMax - rMin);
    return { ...s, score, xy: point(i, r), labelXy: point(i, rLabel) };
  });

  return (
    <svg viewBox="0 0 220 200" className="w-full max-w-[280px] mx-auto" role="img"
      aria-label={values.map((v) => `${v.label} ${v.score}`).join(", ")}>
      {[12, 16, 20].map((ring) => (
        <polygon key={ring} points={ringAt(ring)} fill="none" stroke="var(--theme-surface-border)" strokeWidth="1" opacity="0.6" />
      ))}
      {values.map((v, i) => {
        const [ex, ey] = point(i, rMax);
        return <line key={v.key} x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--theme-surface-border)" strokeWidth="1" opacity="0.4" />;
      })}
      <polygon
        points={values.map((v) => `${v.xy[0].toFixed(1)},${v.xy[1].toFixed(1)}`).join(" ")}
        fill="var(--theme-glow)"
        stroke="var(--theme-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {values.map((v) => (
        <circle key={v.key} cx={v.xy[0]} cy={v.xy[1]} r="3" fill="var(--theme-accent)" />
      ))}
      {values.map((v) => (
        <text
          key={v.key}
          x={v.labelXy[0]}
          y={v.labelXy[1]}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fontWeight="700"
          fill="var(--theme-text-muted)"
        >
          {v.short} {v.score}
        </text>
      ))}
    </svg>
  );
}

export default function HeroSheet({ totals, events }: { totals: StatTotals; events: HeroSheetEvent[] }) {
  const heroClass = computeHeroClass(totals);

  return (
    <div className="rounded-2xl border p-4 mb-6" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
      <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--theme-text-muted)" }}>
        🎲 Scheda dell&apos;Eroe
      </h2>

      {/* La classe: non la scegli, la diventi */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">{heroClass.icon}</span>
        <div className="min-w-0">
          <p className="text-lg font-bold text-[#ede9ff] leading-tight">{heroClass.name}</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{heroClass.flavor}</p>
        </div>
      </div>

      <Radar totals={totals} />

      {/* Una riga per stat: punteggio e strada verso il gradino successivo */}
      <div className="space-y-2 mt-4">
        {STATS.map((s) => {
          const info = scoreFromPoints(totals[s.key]);
          const pct = info.nextCost ? Math.round((info.towardNext / info.nextCost) * 100) : 100;
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span className="text-base w-6 text-center flex-none">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-[#ede9ff]">
                    {s.label}{" "}
                    <span className="font-normal" style={{ color: "var(--theme-text-muted)" }}>· {s.hint}</span>
                  </p>
                  <p className="text-sm font-bold tabular-nums flex-none" style={{ color: "var(--theme-accent)" }}>
                    {info.score}
                  </p>
                </div>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(120,120,140,0.25)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: info.nextCost ? "var(--theme-bar)" : "var(--theme-accent)" }}
                    title={info.nextCost ? `${info.towardNext}/${info.nextCost} verso ${info.score + 1}` : "Al massimo"}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Il registro: ogni punto con la sua provenienza */}
      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--theme-text-muted)" }}>
          Registro
        </p>
        {events.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
            Il registro è vuoto: da oggi ogni gesto conta. Completa una milestone,
            logga un allenamento o spunta un&apos;abitudine e comparirà qui.
          </p>
        ) : (
          <div className="space-y-1.5">
            {events.map((e) => {
              const def = STATS.find((s) => s.key === e.stat);
              return (
                <div key={e.id} className="flex items-center gap-2 text-xs">
                  <span
                    className="font-bold tabular-nums flex-none w-14"
                    style={{ color: "var(--theme-accent)" }}
                  >
                    +{e.points} {def?.short ?? e.stat.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-[#ede9ff]">{e.label}</span>
                  <span className="flex-none" style={{ color: "var(--theme-text-muted)" }}>{shortDate(e.date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
