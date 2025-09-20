import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const BUCKET = process.env.SUPABASE_BUCKET!;
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list("", { limit: 10 });
    if (error) throw error;
    return NextResponse.json({ ok: true, bucket: BUCKET, roots: data?.map(d => d.name) ?? [] });
  } catch (e: any) {
    console.error("Storage ping fail:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
