import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initHealthMetricTable } from "@/lib/init-tables";
import { isKnownMetric, localDateKey, METRICS } from "@/lib/health";

// GET /api/health?days=30[&type=steps]
// Restituisce i campioni grezzi: l'aggregazione per giorno la fa il client
// con dailySeries(), così le due viste (grafico e dettaglio) restano coerenti.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const type = url.searchParams.get("type");

  if (type && !isKnownMetric(type)) {
    return NextResponse.json({ error: "Unknown metric type" }, { status: 400 });
  }

  try {
    await initHealthMetricTable();
  } catch {
    return NextResponse.json({ metrics: [], lastSync: null });
  }

  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromDate = localDateKey(from);

  const metrics = await prisma.healthMetric.findMany({
    where: {
      userId: session.user.id,
      date: { gte: fromDate },
      ...(type ? { metricType: type } : {}),
    },
    select: {
      id: true,
      metricType: true,
      value: true,
      unit: true,
      date: true,
      recordedAt: true,
      sourceName: true,
      metadata: true,
    },
    orderBy: { recordedAt: "asc" },
  });

  // Peso a fonte unica: finché non c'è una bilancia smart che scrive su
  // Health Connect, le pesate arrivano dal registro manuale di /peso. Le
  // righe vengono presentate nella stessa forma delle altre metriche, così
  // la schermata Salute non sa (né deve sapere) da dove vengono. Se un
  // giorno arriveranno campioni veri di tipo weight, vinceranno loro.
  const hasWearableWeight = metrics.some((m) => m.metricType === "weight");
  if (!hasWearableWeight && (!type || type === "weight")) {
    try {
      const entries = await prisma.weightEntry.findMany({
        where: { userId: session.user.id, date: { gte: from } },
        select: { id: true, weight: true, date: true },
        orderBy: { date: "asc" },
      });
      for (const e of entries) {
        metrics.push({
          id: `we_${e.id}`,
          metricType: "weight",
          value: e.weight,
          unit: "kilogram",
          date: localDateKey(e.date),
          recordedAt: e.date,
          sourceName: "Registro peso",
          metadata: null,
        });
      }
    } catch {
      // senza il registro manuale la tile Peso resta semplicemente vuota
    }
  }

  const last = await prisma.healthMetric.findFirst({
    where: { userId: session.user.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Soglie delle missioni collegate a una metrica: la schermata le disegna
  // come barra di avanzamento, così l'obiettivo mostrato è quello che l'utente
  // ha davvero impostato e non un numero di default inventato qui.
  let goals: { metric: string; target: number; title: string }[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<{ healthMetric: string; healthTarget: number; title: string }[]>(
      `SELECT "healthMetric", "healthTarget", title FROM "Goal"
       WHERE "userId" = $1 AND status = 'active'
         AND "healthMetric" IS NOT NULL AND "healthTarget" IS NOT NULL`,
      session.user.id
    );
    goals = rows
      .filter((r) => isKnownMetric(r.healthMetric) && Number(r.healthTarget) > 0)
      .map((r) => ({ metric: r.healthMetric, target: Number(r.healthTarget), title: r.title }));
  } catch {
    // Senza le colonne health sulle missioni la schermata resta utilizzabile,
    // solo senza barra dell'obiettivo.
  }

  return NextResponse.json({
    metrics,
    lastSync: last?.createdAt ?? null,
    goals,
    registry: METRICS,
  });
}

// DELETE /api/health?type=steps — rimuove una metrica (tutto lo storico).
// Senza `type` non cancella nulla: evita di svuotare per sbaglio l'intera
// cronologia con una chiamata a mano.
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");
  if (!type || !isKnownMetric(type)) {
    return NextResponse.json({ error: "A known ?type= is required" }, { status: 400 });
  }

  await initHealthMetricTable();
  const { count } = await prisma.healthMetric.deleteMany({
    where: { userId: session.user.id, metricType: type },
  });

  return NextResponse.json({ deleted: count });
}
