import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type OFFProduct = {
  product_name?: string;
  product_name_it?: string;
  brands?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "proteins_100g"?: number;
    "carbohydrates_100g"?: number;
    "fat_100g"?: number;
    "fiber_100g"?: number;
  };
  ingredients_text_it?: string;
  ingredients_text?: string;
  image_url?: string;
};

export type SearchProduct = {
  name: string;
  brand: string;
  kcalPer100g: number;
  proteins: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: string;
  imageUrl: string;
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  let products: OFFProduct[] = [];
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=8&fields=product_name,product_name_it,brands,nutriments,ingredients_text_it,ingredients_text,image_url`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GoalTracker/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as { products?: OFFProduct[] };
    products = data.products ?? [];
  } catch {
    return NextResponse.json([]);
  }

  const results: SearchProduct[] = products
    .filter(p => {
      const kcal = Number(p.nutriments?.["energy-kcal_100g"] ?? 0);
      const name = p.product_name_it || p.product_name;
      return name && kcal > 0;
    })
    .map(p => ({
      name: (p.product_name_it || p.product_name)!,
      brand: p.brands ?? "",
      kcalPer100g: Math.round(Number(p.nutriments!["energy-kcal_100g"])),
      proteins: Math.round((Number(p.nutriments?.proteins_100g ?? 0)) * 10) / 10,
      carbs: Math.round((Number(p.nutriments?.carbohydrates_100g ?? 0)) * 10) / 10,
      fat: Math.round((Number(p.nutriments?.fat_100g ?? 0)) * 10) / 10,
      fiber: Math.round((Number(p.nutriments?.fiber_100g ?? 0)) * 10) / 10,
      ingredients: (p.ingredients_text_it || p.ingredients_text || "").slice(0, 300),
      imageUrl: p.image_url ?? "",
    }));

  return NextResponse.json(results);
}
