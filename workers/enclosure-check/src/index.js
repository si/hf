// Fetches a Pinecast-hosted episode MP3 and reports its exact file size
// plus an estimated duration (from the first MPEG frame's bitrate), so a
// ready-to-paste `enclosure`/`duration` front matter pair can be produced
// without needing ffprobe or direct network access to pinecast.com - both
// unavailable from a Claude Code sandbox session (see CLAUDE.md).
//
// GET /?url=<pinecast mp3 url>          -> JSON
// GET /?url=<pinecast mp3 url>&format=text -> plain-text front matter lines

const ALLOWED_HOST = "pinecast.com";

// First 64KB is enough to skip any ID3v2 tag and reach the first MPEG frame.
const PROBE_BYTES = 65536;

const MPEG1_LAYER3_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const MPEG2_LAYER3_BITRATES = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
const SAMPLE_RATES = {
  // [MPEG2.5, reserved, MPEG2, MPEG1]
  0: [11025, 0, 22050, 44100],
  1: [12000, 0, 24000, 48000],
  2: [8000, 0, 16000, 32000],
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" },
  });
}

function skipId3v2(bytes) {
  if (bytes.length < 10) return 0;
  const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33; // "ID3"
  if (!isId3) return 0;
  // Synchsafe 28-bit size, big-endian, 7 bits per byte.
  const size =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);
  return 10 + size;
}

function findFrameHeader(bytes, startOffset) {
  for (let i = startOffset; i < bytes.length - 4; i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];

      const versionBits = (b1 >> 3) & 0x03; // 00=MPEG2.5, 10=MPEG2, 11=MPEG1
      const layerBits = (b1 >> 1) & 0x03; // 01=Layer III
      if (versionBits === 1 || layerBits !== 1) continue; // reserved version, or not Layer III

      const bitrateIndex = (b2 >> 4) & 0x0f;
      const sampleRateIndex = (b2 >> 2) & 0x03;
      if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;

      const isMpeg1 = versionBits === 3;
      const bitrateKbps = (isMpeg1 ? MPEG1_LAYER3_BITRATES : MPEG2_LAYER3_BITRATES)[bitrateIndex];
      const sampleRate = SAMPLE_RATES[sampleRateIndex][versionBits];
      if (!bitrateKbps || !sampleRate) continue;

      return { offset: i, bitrateKbps, sampleRate, mpegVersion: isMpeg1 ? 1 : 2 };
    }
  }
  return null;
}

function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

async function probe(targetUrl) {
  const res = await fetch(targetUrl, {
    headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
    cf: { cacheTtl: 0 },
  });

  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`Upstream returned ${res.status}`);
  }

  const contentRange = res.headers.get("content-range"); // "bytes 0-65535/85231234"
  let totalBytes;
  if (contentRange) {
    totalBytes = parseInt(contentRange.split("/")[1], 10);
  } else {
    const len = res.headers.get("content-length");
    if (!len) throw new Error("Upstream did not report a total size");
    totalBytes = parseInt(len, 10);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  const audioStart = skipId3v2(buf);
  const frame = findFrameHeader(buf, audioStart);

  let bitrateKbps = null;
  let durationSeconds = null;
  if (frame) {
    bitrateKbps = frame.bitrateKbps;
    durationSeconds = (totalBytes * 8) / (bitrateKbps * 1000);
  }

  return { totalBytes, bitrateKbps, durationSeconds };
}

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get("url");
    const format = requestUrl.searchParams.get("format") || "json";

    if (!targetUrl) {
      return jsonResponse({ error: "Missing ?url= query parameter" }, 400);
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      return jsonResponse({ error: "Invalid url" }, 400);
    }

    if (parsedTarget.hostname !== ALLOWED_HOST) {
      return jsonResponse(
        { error: `Only ${ALLOWED_HOST} URLs are allowed, got ${parsedTarget.hostname}` },
        400
      );
    }

    try {
      const { totalBytes, bitrateKbps, durationSeconds } = await probe(parsedTarget.toString());
      const enclosure = `${parsedTarget.toString()} ${totalBytes} audio/mpeg`;
      const duration = durationSeconds !== null ? formatDuration(durationSeconds) : null;

      if (format === "text") {
        const lines = [`enclosure: "${enclosure}"`];
        if (duration) lines.push(`duration: "${duration}"`);
        if (!bitrateKbps) lines.push("# duration estimate unavailable - no MPEG frame header found");
        return textResponse(lines.join("\n") + "\n");
      }

      return jsonResponse({
        url: parsedTarget.toString(),
        bytes: totalBytes,
        sizeMB: (totalBytes / 1_000_000).toFixed(1),
        bitrateKbps,
        durationSeconds: durationSeconds !== null ? Math.round(durationSeconds) : null,
        duration,
        durationNote: bitrateKbps
          ? "Estimated from size / first-frame bitrate - exact for CBR, may drift on VBR files."
          : "No MPEG frame header found; duration unavailable.",
        enclosure,
      });
    } catch (err) {
      return jsonResponse({ error: err.message }, 502);
    }
  },
};
