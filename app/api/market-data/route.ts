import { NextResponse } from "next/server";
import { fetchOfficialData } from "../../../lib/official-data";

export async function GET() {
  try {
    return NextResponse.json(await fetchOfficialData(), {
      headers: {
        "Cache-Control": "private, max-age=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "公式データの自動取得に失敗しました",
        fallback: "公式CSVまたは対応CSVを読み込んでください",
      },
      { status: 502 },
    );
  }
}
