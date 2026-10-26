#!/usr/bin/env python3
"""Minimal Buffer GraphQL client, one API key per brand.

Each brand reads its own env var, so brands never share a connection and this
never touches the personal Buffer OAuth connector:

    superrams    -> BUFFER_API_KEY_SUPERRAMS
    housefinesse -> BUFFER_API_KEY_HOUSEFINESSE
    petals       -> BUFFER_API_KEY_PETALS

Usage:
    buffer.py superrams account
    buffer.py superrams channels --org ORG_ID
    buffer.py superrams post --channel CHANNEL_ID --text "..." [--due-at ISO8601 | --now] [--dry-run]
    buffer.py superrams query 'query { account { id } }'
    buffer.py superrams schema

Default post mode is addToQueue; --due-at schedules for a specific time and
--now publishes straight away (shareNow).
Override the endpoint with BUFFER_API_URL if Buffer moves it.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BRANDS = {
    "superrams": "BUFFER_API_KEY_SUPERRAMS",
    "housefinesse": "BUFFER_API_KEY_HOUSEFINESSE",
    "petals": "BUFFER_API_KEY_PETALS",
}
URL = os.environ.get("BUFFER_API_URL", "https://api.buffer.com")


def call(brand, query, variables=None):
    var = BRANDS[brand]
    key = os.environ.get(var)
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    # With no key set, send no Authorization header and rely on the proxy to inject one.
    req = urllib.request.Request(
        URL,
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} from Buffer: {e.read().decode()[:500]}")
    if body.get("errors"):
        sys.exit(json.dumps(body["errors"], indent=2))
    return body["data"]


ACCOUNT = "query { account { id email organizations { id name } } }"
CHANNELS = """query($org: OrganizationId!) {
  channels(input: { organizationId: $org }) { id name service }
}"""
CREATE_POST = """mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id text status dueAt } }
    ... on MutationError { message }
  }
}"""
SCHEMA = "query { __schema { queryType { fields { name } } mutationType { fields { name } } } }"


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("brand", choices=BRANDS)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("account")
    sub.add_parser("schema")
    c = sub.add_parser("channels")
    c.add_argument("--org", required=True)
    q = sub.add_parser("query")
    q.add_argument("graphql")
    po = sub.add_parser("post")
    po.add_argument("--channel", required=True)
    po.add_argument("--text", required=True)
    po.add_argument("--due-at", help="ISO 8601 with UTC offset, e.g. 2026-10-31T09:00:00+00:00")
    po.add_argument("--now", action="store_true", help="publish straight away instead of queueing")
    po.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    if a.cmd == "post" and a.now and a.due_at:
        p.error("use either --now or --due-at, not both")

    if a.cmd == "account":
        out = call(a.brand, ACCOUNT)
    elif a.cmd == "schema":
        out = call(a.brand, SCHEMA)
    elif a.cmd == "channels":
        out = call(a.brand, CHANNELS, {"org": a.org})
    elif a.cmd == "query":
        out = call(a.brand, a.graphql)
    else:
        inp = {"channelId": a.channel, "text": a.text, "schedulingType": "automatic",
               "mode": "shareNow" if a.now else "customScheduled" if a.due_at else "addToQueue"}
        if a.due_at:
            inp["dueAt"] = a.due_at
        if a.dry_run:
            out = {"dry_run": True, "input": inp}
        else:
            out = call(a.brand, CREATE_POST, {"input": inp})
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
