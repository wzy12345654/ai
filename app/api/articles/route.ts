import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { articles } from "@/db/schema";
import { getDb } from "@/lib/db";

export async function GET() {
  const rows = await getDb().select().from(articles).orderBy(desc(articles.updatedAt));
  return NextResponse.json(rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) })));
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.title || !body?.payload) return NextResponse.json({ error: "缺少作品内容" }, { status: 400 });
  const [saved] = await getDb().insert(articles).values({ title: body.title, payload: JSON.stringify(body.payload) }).returning();
  return NextResponse.json({ ...saved, payload: JSON.parse(saved.payload) });
}
