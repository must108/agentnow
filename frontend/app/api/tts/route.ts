export const runtime = "nodejs";

const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_turbo_v2";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "expected application/json" }), {
        status: 415,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json().catch(() => ({} as any));
    if (!text || !String(text).trim()) {
      return new Response(JSON.stringify({ error: "missing text" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY || "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing ELEVENLABS_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: String(text),
          model_id: MODEL_ID,
        }),
      }
    );

    if (!upstream.ok) {
      const body = await upstream.text();
      console.error("ElevenLabs upstream error:", upstream.status, body);
      return new Response(
        JSON.stringify({
          error: "upstream_error",
          status: upstream.status,
          body,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("TTS Route Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
