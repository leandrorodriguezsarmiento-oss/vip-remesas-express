import { NextResponse } from "next/server";
export const GET = () => NextResponse.json({ ok: true, ts: Date.now() });
