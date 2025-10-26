// app/api/tts/route.ts
import { ElevenLabsClient } from "elevenlabs";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text || !text.trim()) {
    return new Response(JSON.stringify({ error: "missing text" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
  const voiceId = "21m00Tcm4TlvDq8ikWAM";

  const nodeStream = await client.textToSpeech.convert(voiceId, {
    model_id: "eleven_turbo_v2",
    text,
    output_format: "mp3_44100_128",
  });

  // Convert Node Readable -> Web ReadableStream for Response
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
}
