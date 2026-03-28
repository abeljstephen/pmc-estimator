#!/usr/bin/env python3
"""
Archive all GAS versions to a git branch with original timestamps.
Creates one backdated commit per version on branch: gas-version-archive
"""

import json, os, subprocess, sys, time, shutil, ssl
from datetime import datetime, timezone

import urllib.request, urllib.error

# macOS Python 3.12 needs this
_ssl_ctx = ssl.create_default_context()
try:
    import certifi
    _ssl_ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    pass

SCRIPT_ID   = '1O1lerl7umTJb9at87fOQFVFWOVzXI31QzB3itGH2FiFaceGPr7Zd7AzO'
REPO_ROOT   = '/Users/abeljstephen/pmc-estimator'
ARCHIVE_DIR = os.path.join(REPO_ROOT, 'gas-archive')
BRANCH      = 'gas-version-archive'

# ---------- auth ----------

def get_access_token():
    with open(os.path.expanduser('~/.clasprc.json')) as f:
        creds = json.load(f)
    t = creds['tokens']['default']
    # Refresh if expired
    expiry = t.get('expiry_date', 0)
    if expiry and expiry > int(time.time() * 1000) + 60000:
        return t['access_token']
    # Refresh
    data = json.dumps({
        'client_id':     t['client_id'],
        'client_secret': t['client_secret'],
        'refresh_token': t['refresh_token'],
        'grant_type':    'refresh_token'
    }).encode()
    req = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, context=_ssl_ctx) as resp:
        new_token = json.loads(resp.read())
    # Update clasprc
    t['access_token'] = new_token['access_token']
    t['expiry_date'] = int(time.time() * 1000) + new_token.get('expires_in', 3600) * 1000
    with open(os.path.expanduser('~/.clasprc.json'), 'w') as f:
        json.dump(creds, f, indent=2)
    return new_token['access_token']


def api_get(url, token):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req, context=_ssl_ctx) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  HTTP {e.code}: {body[:200]}')
        return None


# ---------- git helpers ----------

def run(cmd, env=None, cwd=REPO_ROOT):
    full_env = {**os.environ, **(env or {})}
    result = subprocess.run(cmd, shell=True, cwd=cwd, env=full_env,
                            capture_output=True, text=True)
    if result.returncode != 0:
        print(f'  CMD FAILED: {cmd}\n  {result.stderr.strip()}')
    return result.stdout.strip()


def git_commit_backdated(iso_timestamp, message):
    env = {
        'GIT_AUTHOR_DATE':    iso_timestamp,
        'GIT_COMMITTER_DATE': iso_timestamp,
    }
    run('git add -A gas-archive/', env=env)
    result = subprocess.run(
        ['git', 'commit', '-m', message],
        cwd=REPO_ROOT,
        env={**os.environ, **env},
        capture_output=True, text=True
    )
    if result.returncode != 0 and 'nothing to commit' in result.stdout + result.stderr:
        print('  (nothing to commit, skipping)')
        return False
    if result.returncode != 0:
        print(f'  COMMIT FAILED: {result.stderr.strip()}')
        return False
    return True


# ---------- main ----------

def main():
    token = get_access_token()
    print('Token OK')

    # List all versions
    data = api_get(
        f'https://script.googleapis.com/v1/projects/{SCRIPT_ID}/versions?pageSize=100',
        token
    )
    if not data:
        print('Failed to list versions'); sys.exit(1)

    versions = data.get('versions', [])
    print(f'Found {len(versions)} versions')

    # Sort ascending by version number
    versions.sort(key=lambda v: int(v.get('versionNumber', 0)))

    # Set up branch
    existing = run('git branch --list gas-version-archive')
    if existing:
        print(f'Branch {BRANCH} already exists — appending commits')
        run(f'git checkout {BRANCH}')
    else:
        # Create orphan branch so it doesn't inherit main history
        run(f'git checkout --orphan {BRANCH}')
        run('git rm -rf . --quiet 2>/dev/null || true')
        print(f'Created orphan branch {BRANCH}')

    os.makedirs(ARCHIVE_DIR, exist_ok=True)

    for v in versions:
        vnum = int(v.get('versionNumber', 0))
        desc = v.get('description', '(no description)')
        create_time = v.get('createTime', '')  # ISO 8601

        print(f'\n--- Version {vnum}: {desc}')
        print(f'    Created: {create_time}')

        # Fetch file content at this version
        content_data = api_get(
            f'https://script.googleapis.com/v1/projects/{SCRIPT_ID}/content?versionNumber={vnum}',
            token
        )
        if not content_data:
            print(f'  Skipping v{vnum} (content fetch failed)')
            continue

        files = content_data.get('files', [])
        version_dir = os.path.join(ARCHIVE_DIR, f'v{vnum:03d}')
        os.makedirs(version_dir, exist_ok=True)

        # Write metadata
        meta = {
            'versionNumber': vnum,
            'description':   desc,
            'createTime':    create_time,
            'fileCount':     len(files)
        }
        with open(os.path.join(version_dir, '_version.json'), 'w') as f:
            json.dump(meta, f, indent=2)

        # Write each file
        for file in files:
            name     = file.get('name', 'unknown')
            ftype    = file.get('type', '')
            source   = file.get('source', '')
            ext      = '.gs' if ftype == 'SERVER_JS' else '.json' if ftype == 'JSON' else '.html' if ftype == 'HTML' else '.txt'
            fname    = name if '.' in name else name + ext
            # Preserve directory structure (name may contain slashes)
            fpath    = os.path.join(version_dir, fname)
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(source or '')

        print(f'  Wrote {len(files)} files to gas-archive/v{vnum:03d}/')

        # Backdated commit
        ts = create_time if create_time else datetime.now(timezone.utc).isoformat()
        commit_msg = f'GAS v{vnum}: {desc}'
        git_commit_backdated(ts, commit_msg)

    # Push branch
    print('\nPushing gas-version-archive branch...')
    run(f'git push -u origin {BRANCH}')

    # Return to main
    run('git checkout main')

    print('\nDone. All versions archived to branch gas-version-archive.')
    print(f'Now safe to delete GAS versions 1–50 and 52–67.')


if __name__ == '__main__':
    main()
