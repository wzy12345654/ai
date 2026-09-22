import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { articles } from "@/db/schema";
import { getDb } from "@/lib/db";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const [saved] = await getDb().update(articles).set({ title: body.title, payload: JSON.stringify(body.payload), updatedAt: new Date() }).where(eq(articles.id, Number(id))).returning();
  return NextResponse.json(saved ? { ...saved, payload: JSON.parse(saved.payload) } : { error: "作品不存在" }, { status: saved ? 200 : 404 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await getDb().delete(articles).where(eq(articles.id, Number(id)));
  return NextResponse.json({ ok: true });
}
