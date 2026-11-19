import type { NextRequest } from "next/server";
import {
  PassConfigError,
  PassInputError,
  buildPosterPass,
  parsePosterFields,
  passFileName,
} from "@/lib/pass-builder";
import { MAX_POSTER_UPLOAD_BYTES } from "@/lib/pass-types";
import { getPassStore } from "@/lib/pass-store";
import { PosterImageError, processPosterImage } from "@/lib/poster-image";

/** Room for the card fields and multipart boundaries around the image. */
const MAX_BODY_BYTES = MAX_POSTER_UPLOAD_BYTES + 64 * 1024;
const TOO_LARGE = "That image is over the 4 MB limit.";

const noStore = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: noStore });
}

async function readLimitedBody(request: NextRequest): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw new PosterImageError(TOO_LARGE, 413);
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new PosterImageError(TOO_LARGE, 413);
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function readForm(request: NextRequest): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new PassInputError("Send the card as multipart form data.");
  }

  const body = await readLimitedBody(request);
  try {
    return await new Response(body as BodyInit, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new PassInputError("Invalid card details.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await readForm(request);
    const fields = parsePosterFields(form);

    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) {
      throw new PassInputError("Add an image first");
    }
    if (image.size > MAX_POSTER_UPLOAD_BYTES) {
      throw new PosterImageError(TOO_LARGE, 413);
    }

    const images = await processPosterImage(
      Buffer.from(await image.arrayBuffer()),
    );
    const data = buildPosterPass(fields, images);
    const token = await getPassStore().save({
      data,
      fileName: passFileName(fields.name),
    });

    return Response.json(
      { url: `/api/pass/download/${token}` },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof PassInputError) {
      return errorResponse(error.message, 400);
    }
    if (error instanceof PosterImageError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof PassConfigError) {
      console.error("Apple Wallet signing is not configured.");
      return errorResponse("Apple Wallet signing isn't set up yet.", 503);
    }
    // The error's name only, because messages can contain card details.
    console.error(
      "Could not create Poster pass:",
      error instanceof Error ? error.name : "unknown error",
    );
    return errorResponse("Couldn't create the pass.", 500);
  }
}
