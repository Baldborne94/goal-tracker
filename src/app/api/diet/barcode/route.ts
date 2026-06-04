import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type OFFNutriments = {
  "energy-kcal_100g"?: number;
  "proteins_100g"?: number;
  "carbohydrates_100g"?: number;
  "fat_100g"?: number;
  "fiber_100g"?: number;
  "sugars_100g"?: number;
  "salt_100g"?: number;
};

type OFFProduct = {
  product_name?: string;
  product_name_it?: string;
  brands?: string;
  quantity?: string;
  nutriments?: OFFNutriments;
  ingredients_text?: string;
  ingredients_text_it?: string;
  image_url?: string;
};

type OFFResponse = { status: number; product?: OFFProduct };

export type BarcodeProduct = {
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

  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing barcode" }, { status: 400 });

  let data: OFFResponse;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`, {
      headers: { "User-Agent": "GoalTracker/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    data = await res.json() as OFFResponse;
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }

  if (data.status !== 1 || !data.product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const p = data.product;
  const n = p.nutriments ?? {};
  const name = p.product_name_it || p.product_name || "Unknown product";
  const kcal = Number(n["energy-kcal_100g"] ?? 0);

  if (!kcal) {
    return NextResponse.json({ error: "No nutritional data" }, { status: 404 });
  }

  const product: BarcodeProduct = {
    name,
    brand: p.brands ?? "",
    kcalPer100g: Math.round(kcal),
    proteins: Math.round((n["proteins_100g"] ?? 0) * 10) / 10,
    carbs: Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10,
    fat: Math.round((n["fat_100g"] ?? 0) * 10) / 10,
    fiber: Math.round((n["fiber_100g"] ?? 0) * 10) / 10,
    ingredients: (p.ingredients_text_it || p.ingredients_text || "").slice(0, 300),
    imageUrl: p.image_url ?? "",
  };

  return NextResponse.json(product);
}
