#!/usr/bin/env python3
"""
MoniDuck — Anytype Integration
Usage:
  python scripts/anytype.py journal
  python scripts/anytype.py feature create "Dashboard"
  python scripts/anytype.py feature update "Dashboard"
"""

import sys
import json
import os
import urllib.request
import urllib.error
from datetime import datetime

# ─── CONFIG ───────────────────────────────────────────────────────────────────

# Charge la clé depuis .env.anytype
def load_api_key():
    env_file = os.path.join(os.path.dirname(__file__), '..', '.env.anytype')
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                if line.startswith('ANYTYPE_API_KEY='):
                    return line.strip().split('=', 1)[1]
    return os.environ.get('ANYTYPE_API_KEY')

API_KEY    = load_api_key()
BASE_URL   = "http://127.0.0.1:31009/v1"
SPACE_ID   = "bafyreieixejt4lkndllh7ojwvj7l5we22wx3u466kc4ggeo6huiwpwjk44.1tzbokjbcail1"
TYPE_PAGE  = "bafyreicqerohgpxpounkgx7vwqyhifehxjyxecqwil23jsls72rg2tdjwu"
TPL_FEATURE = "bafyreihr2www5vvf4roa5efleihyw6v52f5sqtlxwnfrtkhumgr3kmmj5i"
TPL_JOURNAL = "bafyreihe6etimniypq72j7pkt46hx6fe366p2b5qyizr6lbxf4qfdaxqdy"

# ─── HTTP HELPERS ─────────────────────────────────────────────────────────────

def api_request(method, path, body=None):
    url = f"{BASE_URL}{path}"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Anytype-Version": "2025-11-08",
        "Authorization": f"Bearer {API_KEY}"
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error {e.code}: {e.read().decode()}")
        sys.exit(1)

# ─── SEARCH ───────────────────────────────────────────────────────────────────

def find_object_by_name(name):
    """Cherche une page existante par son nom."""
    result = api_request("POST", f"/spaces/{SPACE_ID}/objects/search", {
        "query": name,
        "types": [TYPE_PAGE],
        "limit": 10
    })
    for obj in result.get("data", []):
        if obj.get("name", "").lower() == name.lower():
            return obj
    return None

# ─── ACTIONS ──────────────────────────────────────────────────────────────────

def create_journal():
    """Crée une entrée journal pour aujourd'hui."""
    today = datetime.now().strftime("%Y-%m-%d")
    name = f"Journal — {today}"

    # Vérifie si une entrée existe déjà aujourd'hui
    existing = find_object_by_name(name)
    if existing:
        print(f"⚠️  Une entrée journal existe déjà pour aujourd'hui : {name}")
        print(f"   ID : {existing['id']}")
        return

    result = api_request("POST", f"/spaces/{SPACE_ID}/objects", {
        "name": name,
        "type_id": TYPE_PAGE,
        "template_id": TPL_JOURNAL
    })
    print(f"✅ Journal créé : {name}")
    print(f"   ID : {result.get('object', {}).get('id', '?')}")

def create_feature(name):
    """Crée une nouvelle page feature depuis le template."""
    existing = find_object_by_name(name)
    if existing:
        print(f"⚠️  La feature '{name}' existe déjà.")
        print(f"   ID : {existing['id']}")
        print(f"   Utilise 'feature update' pour la modifier.")
        return

    result = api_request("POST", f"/spaces/{SPACE_ID}/objects", {
        "name": name,
        "type_id": TYPE_PAGE,
        "template_id": TPL_FEATURE
    })
    print(f"✅ Feature créée : {name}")
    print(f"   ID : {result.get('object', {}).get('id', '?')}")

def update_feature(name):
    """Trouve une feature existante et affiche son ID pour mise à jour."""
    obj = find_object_by_name(name)
    if not obj:
        print(f"❌ Feature '{name}' introuvable.")
        print(f"   Utilise 'feature create' pour la créer.")
        return
    print(f"✅ Feature trouvée : {name}")
    print(f"   ID : {obj['id']}")
    print(f"   → Utilise cet ID pour mettre à jour le contenu via l'API.")

# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    if not API_KEY:
        print("❌ ANYTYPE_API_KEY manquant. Vérifie .env.anytype")
        sys.exit(1)

    args = sys.argv[1:]

    if not args:
        print(__doc__)
        sys.exit(0)

    command = args[0]

    if command == "journal":
        create_journal()

    elif command == "feature":
        if len(args) < 3:
            print("Usage: python scripts/anytype.py feature [create|update] 'Nom feature'")
            sys.exit(1)
        action, name = args[1], args[2]
        if action == "create":
            create_feature(name)
        elif action == "update":
            update_feature(name)
        else:
            print(f"❌ Action inconnue : {action}")

    else:
        print(f"❌ Commande inconnue : {command}")
        print(__doc__)

if __name__ == "__main__":
    main()
