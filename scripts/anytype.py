#!/usr/bin/env python3
"""
MoniDuck — Anytype Integration
Usage:
  python3 scripts/anytype.py journal
  python3 scripts/anytype.py feature update "Dashboard" "Contenu markdown ici"
"""

import sys
import json
import os
import urllib.request
import urllib.error
from datetime import datetime

# ─── CONFIG ───────────────────────────────────────────────────────────────────

def load_api_key():
    env_file = os.path.join(os.path.dirname(__file__), '..', '.env.anytype')
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                if line.startswith('ANYTYPE_API_KEY='):
                    return line.strip().split('=', 1)[1]
    return os.environ.get('ANYTYPE_API_KEY')

def load_ids():
    ids_file = os.path.join(os.path.dirname(__file__), 'anytype-ids.json')
    with open(ids_file) as f:
        return json.load(f)

API_KEY  = load_api_key()
BASE_URL = "http://127.0.0.1:31009/v1"
SPACE_ID = "bafyreieixejt4lkndllh7ojwvj7l5we22wx3u466kc4ggeo6huiwpwjk44.1tzbokjbcail1"
TPL_JOURNAL = "bafyreihe6etimniypq72j7pkt46hx6fe366p2b5qyizr6lbxf4qfdaxqdy"

# ─── HTTP ─────────────────────────────────────────────────────────────────────

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

# ─── ACTIONS ──────────────────────────────────────────────────────────────────

def create_journal():
    now = datetime.now()
    name = f"Journal — {now.strftime('%Y-%m-%d %H:%M')}"

    ids = load_ids()
    collection_id = ids.get("_collections", {}).get("journal")
    if not collection_id:
        print(f"⚠️  Collection Dev journaling introuvable dans anytype-ids.json")

    result = api_request("POST", f"/spaces/{SPACE_ID}/objects", {
        "name": name,
        "type_key": "page",
        "template_id": TPL_JOURNAL,
    })
    obj = result.get("object", {})
    journal_id = obj.get("id")
    print(f"✅ Journal créé : {name}")
    print(f"   ID : {journal_id}")

    if collection_id:
        api_request("POST", f"/spaces/{SPACE_ID}/lists/{collection_id}/objects", {
            "object_id": journal_id
        })
        print(f"✅ Ajouté à la collection Dev journaling")

    # Sauvegarde du dernier ID créé pour que journal update sache lequel remplir
    ids["last_journal_id"] = journal_id
    ids_file = os.path.join(os.path.dirname(__file__), 'anytype-ids.json')
    with open(ids_file, 'w') as f:
        json.dump(ids, f, indent=2, ensure_ascii=False)

    return journal_id

def update_journal(content):
    ids = load_ids()
    journal_id = ids.get("last_journal_id")
    if not journal_id:
        print(f"❌ Aucun journal trouvé. Lance d'abord : python3 scripts/anytype.py journal")
        sys.exit(1)
    api_request("PATCH", f"/spaces/{SPACE_ID}/objects/{journal_id}", {
        "markdown": content.replace('\\n', '\n')
    })
    print(f"✅ Journal mis à jour")
    print(f"   ID : {journal_id}")

TPL_FEATURE = "bafyreihr2www5vvf4roa5efleihyw6v52f5sqtlxwnfrtkhumgr3kmmj5i"

def update_feature(name, content):
    ids = load_ids()
    feature_id = ids.get("features", {}).get(name)

    if not feature_id:
        # Feature inconnue → on la crée et on sauvegarde l'ID
        result = api_request("POST", f"/spaces/{SPACE_ID}/objects", {
            "name": name,
            "type_key": "page",
            "template_id": TPL_FEATURE
        })
        obj = result.get("object", {})
        feature_id = obj.get("id")
        ids["features"][name] = feature_id

        ids_file = os.path.join(os.path.dirname(__file__), 'anytype-ids.json')
        with open(ids_file, 'w') as f:
            json.dump(ids, f, indent=2, ensure_ascii=False)

        print(f"✅ Feature créée : {name} (ID : {feature_id})")
    else:
        print(f"   Feature existante : {name}")

    api_request("PATCH", f"/spaces/{SPACE_ID}/objects/{feature_id}", {
        "markdown": content.replace('\\n', '\n')
    })
    print(f"✅ Feature mise à jour : {name}")
    print(f"   ID : {feature_id}")

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
        if len(args) >= 2 and args[1] == "update":
            if len(args) < 3:
                print("Usage: python3 scripts/anytype.py journal update 'Contenu'")
                sys.exit(1)
            update_journal(args[2])
        else:
            create_journal()

    elif command == "feature":
        if len(args) < 4 or args[1] != "update":
            print("Usage: python3 scripts/anytype.py feature update 'Nom' 'Contenu'")
            sys.exit(1)
        update_feature(args[2], args[3])

    else:
        print(f"❌ Commande inconnue : {command}")

if __name__ == "__main__":
    main()
