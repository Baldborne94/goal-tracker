import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initSvuotaFrigoTable } from "@/lib/init-tables";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initSvuotaFrigoTable();
  const recipes = await prisma.$queryRawUnsafe<
    { id: string; ingredients: string; content: string; createdAt: Date }[]
  >(
    `SELECT id, ingredients, content, "createdAt" FROM "SvuotaFrigoRecipe" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    session.user.id
  );

  return NextResponse.json(
    recipes.map(r => ({ ...r, ingredients: JSON.parse(r.ingredients) as string[] }))
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurata" }, { status: 500 });
  }

  const { ingredients } = await req.json() as { ingredients: string[] };
  if (!ingredients?.length) {
    return NextResponse.json({ error: "Nessun ingrediente fornito" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 1500,
          thinking: { type: "adaptive" },
          messages: [
            {
              role: "user",
              content: `Sei un cuoco italiano creativo. Ho questi ingredienti in frigo:\n\n${ingredients.map(i => `• ${i}`).join("\n")}\n\nSuggeriscimi 3 ricette che posso fare con questi ingredienti (puoi assumere che ho sale, pepe, olio e acqua). Per ogni ricetta indica:\n- Nome della ricetta con emoji\n- Tempo di preparazione\n- Ingredienti necessari (evidenzia quelli che NON ho)\n- Procedimento in 3-5 passi brevi\n\nRispondi in italiano, in modo semplice e pratico.`,
            },
          ],
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        controller.enqueue(encoder.encode(`\n\n⚠️ Errore: ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
