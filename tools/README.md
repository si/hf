# tools

## buffer.py

Posts to Buffer via its GraphQL API using a per-brand personal access key, kept
separate from any OAuth Buffer connector.

### Authentication

Two ways to supply the key. Neither puts a key in the repo.

**1. Proxy secret (preferred in cloud sessions).** Add a secret in the cloud
environment settings (Add secret):

| Field | Value |
|---|---|
| Secret type | Bearer |
| Allowed websites | `api.buffer.com` |
| Path prefixes | leave empty |
| Custom header | `Authorization`, prefix `Bearer`, value = the API key |

Get the key from https://publish.buffer.com/settings/api (logged in to the
House Finesse Buffer account). Start a new session after adding it. With no
env var set, `buffer.py` sends no `Authorization` header and the proxy injects
the key.

A host can only carry one key per environment, so use one environment per
brand. **Check `account` first**: if it shows the wrong organisation, the
environment's secret belongs to another brand and nothing should be posted.

**2. Env var.** If set, the script sends it as the bearer token and the proxy
secret isn't needed:

| Brand | Env var |
|---|---|
| housefinesse | `BUFFER_API_KEY_HOUSEFINESSE` |
| superrams | `BUFFER_API_KEY_SUPERRAMS` |
| petals | `BUFFER_API_KEY_PETALS` |

### Usage

```
python3 tools/buffer.py housefinesse account
python3 tools/buffer.py housefinesse channels --org ORG_ID
python3 tools/buffer.py housefinesse post --channel CHANNEL_ID --text "New episode" --dry-run
python3 tools/buffer.py housefinesse post --channel CHANNEL_ID --text "New episode"                      # add to queue
python3 tools/buffer.py housefinesse post --channel CHANNEL_ID --text "New episode" --due-at 2026-10-31T09:00:00+00:00
python3 tools/buffer.py housefinesse post --channel CHANNEL_ID --text "New episode" --now               # straight away
```

`--due-at` needs the UK offset: `+00:00` in winter (GMT), `+01:00` in summer (BST).

### House Finesse IDs

TODO: fill in once the House Finesse key is set up. Run `account` then
`channels --org ORG_ID` to get them.

| Item | ID |
|---|---|
| Organisation (House Finesse) | |
| X | |
| Bluesky | |
