import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // If Auth is not configured locally, keep logout idempotent.
  }

  return NextResponse.json({ ok: true });
}
