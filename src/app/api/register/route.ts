import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  if (!email || !password)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  });

  // seed default categories if not present
  const count = await prisma.category.count();
  if (count === 0) {
    await prisma.category.createMany({
      data: [
        { name: "Health", color: "#22c55e", icon: "heart" },
        { name: "Work", color: "#3b82f6", icon: "briefcase" },
        { name: "Learning", color: "#a855f7", icon: "book-open" },
        { name: "Finance", color: "#f59e0b", icon: "piggy-bank" },
        { name: "Personal", color: "#ec4899", icon: "star" },
      ],
    });
  }

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
