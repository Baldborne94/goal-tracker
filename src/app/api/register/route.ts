import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email già registrata" }, { status: 409 });
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, password: hashed } });
  const count = await prisma.category.count();
  if (count === 0) {
    await prisma.category.createMany({
      data: [
        { name: "Salute", color: "#22c55e", icon: "heart" },
        { name: "Lavoro", color: "#3b82f6", icon: "briefcase" },
        { name: "Apprendimento", color: "#a855f7", icon: "book-open" },
        { name: "Finanze", color: "#f59e0b", icon: "piggy-bank" },
        { name: "Personale", color: "#ec4899", icon: "star" },
      ],
    });
  }
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
