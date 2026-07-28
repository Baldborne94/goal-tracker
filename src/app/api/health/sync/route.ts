import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initHealthMetricTable } from "@/lib/init-tables";
import {
  dedupeBatch,
  isKnownMetric,
  normalizeSamples,
  type HealthMetricInput,
  type RawSample,
} from "@/lib/health";
import { applyHealthGoals } from "@/lib/health-goals";

// Il guscio Android manda qui quello che ha letto da Health Connect.
// Un sync non è mai realtime: parte all'apertura della schermata Salute o dal
// pulsante di aggiornamento.

const MAX_METRICS = 5000;
const CHUNK = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValid(m: HealthMetricInput): boolean {
  return (
    typeof m?.metricType === "string" &&
    isKnownMetric(m.metricType) &&
    Number.isFinite(Number(m.value)) &&
    typeof m.dedupKey === "string" &&
    m.dedupKey.length > 0 &&
    m.dedupKey.length <= 500 &&
    typeof m.date === "string" &&
    DATE_RE.test(m.date) &&
    !Number.isNaN(new Date(m.recordedAt).getTime())
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  // Il client manda le metriche già normalizzate, perché la data locale del
  // giorno va calcolata sul fuso del telefono e non su quello del server.
  // `samples` grezzi restano accettati per comodità di debug da curl.
  const raw: HealthMetricInput[] = Array.isArray(body.metrics)
    ? body.metrics
    : Array.isArray(body.samples)
      ? normalizeSamples(body.samples as RawSample[])
      : [];

  if (raw.length === 0) {
    return NextResponse.json({ saved: 0, skipped: 0, autoCheckIns: [], dates: [] });
  }
  if (raw.length > MAX_METRICS) {
    return NextResponse.json({ error: `Too many metrics (max ${MAX_METRICS})` }, { status: 413 });
  }

  const valid = dedupeBatch(raw.filter(isValid));
  const skipped = raw.length - valid.length;

  try {
    await initHealthMetricTable();
  } catch (e) {
    return NextResponse.json({ error: `DB not ready: ${(e as Error).message}` }, { status: 500 });
  }

  // INSERT multi-riga con ON CONFLICT: rileggere lo stesso giorno aggiorna le
  // righe esistenti invece di duplicarle, ed è ciò che rende il sync ripetibile.
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];

    chunk.forEach((m, idx) => {
      const p = idx * 10;
      values.push(
        `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, 'health_connect', $${p + 8}, $${p + 9}, $${p + 10}::jsonb)`
      );
      params.push(
        `hm_${Math.random().toString(36).slice(2, 11)}${idx}`,
        userId,
        m.metricType,
        Number(m.value),
        m.unit || "count",
        new Date(m.recordedAt),
        m.date,
        m.sourceName ?? null,
        m.dedupKey,
        m.metadata ? JSON.stringify(m.metadata) : null
      );
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "HealthMetric"
         ("id","userId","metricType","value","unit","recordedAt","date","source","sourceName","dedupKey","metadata")
       VALUES ${values.join(", ")}
       ON CONFLICT ("userId","dedupKey") DO UPDATE SET
         "value" = EXCLUDED."value",
         "unit" = EXCLUDED."unit",
         "recordedAt" = EXCLUDED."recordedAt",
         "date" = EXCLUDED."date",
         "sourceName" = EXCLUDED."sourceName",
         "metadata" = EXCLUDED."metadata"`,
      ...params
    );
  }

  const dates = [...new Set(valid.map((m) => m.date))].sort();
  const autoCheckIns = await applyHealthGoals(userId, dates);

  return NextResponse.json({ saved: valid.length, skipped, dates, autoCheckIns });
}
