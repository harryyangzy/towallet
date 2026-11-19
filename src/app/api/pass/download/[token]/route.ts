import type { NextRequest } from "next/server";
import { getPassStore } from "@/lib/pass-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const pass = await getPassStore().read(token);

  if (!pass) {
    return Response.json(
      { error: "This download link has expired." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new Response(new Uint8Array(pass.data), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${pass.fileName}"`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
