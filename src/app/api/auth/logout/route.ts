import { NextResponse } from "next/server";
import { endClientSession } from "@/server/auth";

export async function POST() {
  await endClientSession();
  return NextResponse.json({ ok: true });
}
