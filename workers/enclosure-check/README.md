# enclosure-check worker

Reports the exact file size (and an estimated duration) of a Pinecast
episode MP3, for the `enclosure`/`duration` front matter fields in an
episode post. Exists because `pinecast.com` is blocked by Claude Code
sandbox network policy (same restriction noted in `CLAUDE.md` for Canva's
export-download host), so `curl`/`ffprobe` can't reach it directly from a
session - this Worker runs on Cloudflare's edge instead, outside that
sandbox.

Restricted to `pinecast.com` URLs only (a 400 for anything else), so it
can't be used as an open URL-fetching proxy.

Duration is estimated from the bitrate in the MP3's first MPEG frame
header, combined with the file size - exact for constant-bitrate files
(the normal case for podcast exports), but can drift on VBR files. If no
valid frame header is found, duration is omitted.

## One-time setup

```
cd workers/enclosure-check
wrangler deploy
```

No secrets needed. `workers_dev = true` gives it a public
`https://hf-enclosure-check.<your-subdomain>.workers.dev` URL.

## Usage

```
GET /?url=<pinecast mp3 url>
GET /?url=<pinecast mp3 url>&format=text
```

`format=text` returns plain front matter lines, ready to paste:

```
enclosure: "https://pinecast.com/listen/<id>.mp3 85231234 audio/mpeg"
duration: "01:28:36"
```

The default (JSON) response also includes `bitrateKbps` and a
`durationNote` explaining the estimate.

Handy as an iOS Shortcut: pass the episode's Pinecast URL in, get back
text to paste straight into the post's front matter.
