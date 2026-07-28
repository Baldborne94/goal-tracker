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

  const last = await prisma.healthMetric.findFirst({
    where: { userId: session.user.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    metrics,
    lastSync: last?.createdAt ?? null,
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
