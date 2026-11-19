import type { NextRequest } from "next/server";
import {
  PassConfigError,
  PassInputError,
  buildPass,
  parsePassInput,
  passFileName,
} from "@/lib/pass-builder";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

function createPassResponse(params: URLSearchParams) {
  try {
    const input = parsePassInput(params);
    const body = buildPass(input);

    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${passFileName(input.name)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PassInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof PassConfigError) {
      console.error("Apple Wallet signing is not configured.");
      return Response.json(
        { error: "Apple Wallet signing isn't set up yet." },
        { status: 503 },
      );
    }
    console.error(
      "Could not create Apple Wallet pass:",
      error instanceof Error ? error.name : "unknown error",
    );
    return Response.json(
      { error: "Couldn't create the pass. Check the signing certificates." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return createPassResponse(request.nextUrl.searchParams);
}

/** Passes with an image are too large to send in a URL. */
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json(
      { error: "That image is too large." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid card details." }, { status: 400 });
  }

  const params = new URLSearchParams();
  form.forEach((value, key) => {
    if (typeof value === "string") params.append(key, value);
  });
  return createPassResponse(params);
}
