import { NextResponse } from "next/server";
import { runAutoFill } from "@/use-cases/schedule-match";

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutoFill();

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      invitesSent: result.invitesSent,
      exhausted: result.exhausted,
    });
  } catch (error) {
    console.error("[cron/autofill]", error);
    return NextResponse.json(
      { error: "Auto-fill processing failed" },
      { status: 500 },
    );
  }
}
