# Worklog Sync Behavior

How time tracking syncs between Tract and Jira.

## Overview

When `TRACT_SYNC_SERVER` is configured, worklogs sync bidirectionally:

- **Tract → Jira:** `tract log` creates worklog locally, syncs to Jira
- **Jira → Tract:** Jira worklog additions sync to local JSONL files

## Online Sync Flow

### Logging Time (Tract → Jira)

1. **User runs:** `tract log APP-1234 2h "Fixed bug"`
2. **Tract creates entry** in `worklogs/2026-02.jsonl`
3. **Git commit:** `[tract] Log 2h to APP-1234`
4. **Git push** to remote
5. **Sync server detects commit** (webhook or poll)
6. **Sync server posts worklog to Jira API**
7. **Jira creates worklog** on APP-1234

**Timeline:** Typically 1-5 seconds end-to-end.

### Jira Worklog Added (Jira → Tract)

1. **User logs time in Jira web UI**
2. **Jira sends webhook** to sync server
3. **Sync server parses worklog data**
4. **Sync server appends to** `worklogs/2026-02.jsonl`
5. **Git commit:** `[tract-sync] Add worklog from Jira (APP-1234, john.mcmullan, 2h)`
6. **Git push** to remote
7. **Developer pulls:** `git pull`

**Timeline:** Typically 5-30 seconds.

## Offline Sync Flow

### No Connectivity to Sync Server

1. **User runs:** `tract log APP-1234 2h "Fixed bug"`
2. **Tract creates entry** in `worklogs/2026-02.jsonl`
3. **Git commit** (local)
4. **Tract detects sync server unreachable**
5. **Creates queue entry** in `.tract/queue/worklogs/`
6. **Later, when online:** `git push`
7. **Sync server processes queue**
8. **Worklogs pushed to Jira in batch**

**Timeline:** Next successful sync (could be hours or days).

### Offline Indicator

```bash
tract log APP-1234 2h "Work"
# ⚠️ Sync server unreachable - worklog queued locally

tract log APP-1235 1h "More work"
# ⚠️ Sync server unreachable - worklog queued locally

# Later...
git push
# ✓ Synced 2 queued worklogs to Jira
```

## Conflict Resolution

### Same Ticket, Same Author, Same Time

**Scenario:**
- John logs 2h to APP-1234 at 09:00 in Tract
- John logs 2h to APP-1234 at 09:00 in Jira

**Resolution:**
- Sync server detects duplicate by timestamp + author
- Keeps one, discards duplicate
- No action needed from user

### Different Time on Same Ticket

**Scenario:**
- John logs 2h to APP-1234 at 09:00 in Tract
- Sarah logs 1h to APP-1234 at 10:00 in Jira

**Resolution:**
- Both worklogs kept (different authors and times)
- Both appear in `tract worklogs APP-1234`
- Both appear in Jira

### Retroactive Edits

**Scenario:**
- John logs 2h to APP-1234
- Later edits in Jira to 3h

**Current behavior:**
- Edit creates new worklog entry (Jira limitation)
- Old entry remains in Tract JSONL
- **Workaround:** Delete old entry manually from JSONL

**Future:** Sync server will detect edits and update JSONL.

## Worklog Deletion

### Delete from Tract

**Not directly supported.** Worklogs are append-only JSONL.

**Workaround:**
1. Edit `worklogs/2026-02.jsonl` manually
2. Remove the line
3. Commit: `git commit -am "Remove incorrect worklog"`
4. Push
5. **Note:** Jira worklog remains (no delete sync yet)

### Delete from Jira

**Current behavior:**
- Jira deletion does NOT sync to Tract
- Entry remains in local JSONL
- **Workaround:** Manually remove from JSONL

**Future:** Sync server will detect deletions and mark entries.

## Queue Management

### Queue Location

```
.tract/queue/
└── worklogs/
    ├── 2026-02-14-001.json
    ├── 2026-02-14-002.json
    └── 2026-02-14-003.json
```

Each queued worklog is a JSON file.

### Queue Processing

**Automatic:**
- On `git push`, sync server processes queue
- Processes oldest first (FIFO)
- Deletes queue file after successful sync

**Manual:**
```bash
# View queue
ls .tract/queue/worklogs/

# Clear queue (force sync)
git push
```

### Failed Queue Items

If Jira sync fails (invalid ticket, auth error):
- Queue item remains
- Sync server logs error
- **Fix:** Correct issue (e.g., fix ticket ID), retry push

## Sync Server Configuration

### Environment Variable

```bash
export TRACT_SYNC_SERVER=http://tract-server:3100
echo 'export TRACT_SYNC_SERVER=http://tract-server:3100' >> ~/.bashrc
```

### Config File (Alternative)

`.tract/config.yaml`:
```yaml
sync:
  enabled: true
  server: http://tract-server:3100
```

**Precedence:** Environment variable > config file.

### Testing Connectivity

```bash
curl $TRACT_SYNC_SERVER/health
# {"status":"ok","version":"1.0.0"}
```

## Worklog Field Mapping

### Tract → Jira

| Tract Field | Jira Field | Notes |
|-------------|------------|-------|
| `issue` | Issue key | e.g., APP-1234 |
| `author` | Author username | Must exist in Jira |
| `time` | Time spent | Converts h/m to Jira format |
| `started` | Start time | ISO 8601 timestamp |
| `comment` | Comment/description | Optional |

### Jira → Tract

| Jira Field | Tract Field | Notes |
|------------|-------------|-------|
| Issue key | `issue` | e.g., APP-1234 |
| Author | `author` | Jira username |
| Time spent (seconds) | `time` | Converted to h/m format |
| Started | `started` | ISO 8601 |
| Comment | `comment` | Optional |

## Time Format Conversion

### Tract to Jira

Tract uses human-readable format (`2h`, `30m`, `1d`). Jira API uses seconds.

**Conversion:**
- `2h` → 7200 seconds
- `30m` → 1800 seconds
- `1d` → 28800 seconds (8h)
- `1.5h` → 5400 seconds

### Jira to Tract

Jira sends seconds. Tract converts to readable format.

**Conversion:**
- 7200 seconds → `2h`
- 5400 seconds → `1.5h`
- 1800 seconds → `30m`

**Rounding:**
- Under 1 hour: shows minutes (`45m`)
- 1+ hours: shows hours with decimal (`2.5h`)

## Sync Indicators

### Success
```bash
tract log APP-1234 2h "Work"
# ✓ Logged 2h to APP-1234 (synced to Jira)
```

### Offline
```bash
tract log APP-1234 2h "Work"
# ⚠️ Sync server unreachable - worklog queued locally
```

### Sync Error
```bash
git push
# ✗ Sync error: Issue APP-9999 not found in Jira
```

## Webhook Configuration (Server-Side)

**Jira webhook setup:**
1. Jira → Settings → System → Webhooks
2. Create webhook:
   - URL: `http://tract-server:3100/webhook/jira`
   - Events: Worklog created, Worklog updated, Worklog deleted
   - JQL filter: `project = APP` (optional)

**Sync server receives:**
```json
{
  "webhookEvent": "worklog_created",
  "worklog": {
    "id": "10234",
    "author": "john.mcmullan",
    "timeSpentSeconds": 7200,
    "started": "2026-02-14T09:00:00.000+0000",
    "comment": "Fixed bug",
    "issueId": "12345"
  },
  "issue": {
    "key": "APP-1234"
  }
}
```

## Sync Performance

### Batch Size

When processing queue, sync server batches requests:
- Default: 10 worklogs per batch
- Delay: 100ms between batches (avoid Jira rate limits)

### Large Backlogs

Syncing 100+ queued worklogs:
- Expect ~1 minute processing time
- Monitor sync server logs for progress
- Jira rate limits may slow processing

## Troubleshooting

### Worklogs not appearing in Jira

**Check:**
1. `TRACT_SYNC_SERVER` set correctly
2. Sync server reachable: `curl $TRACT_SYNC_SERVER/health`
3. Git push succeeded
4. Check queue: `ls .tract/queue/worklogs/`

**Fix:**
- If queued: `git push` again
- If sync server down: Wait for server, then push
- If auth error: Check Jira credentials on server

### Duplicate worklogs in Jira

**Cause:**
- Synced twice (queue + manual Jira entry)
- Sync server processed same commit twice (rare)

**Fix:**
- Delete duplicate in Jira web UI
- Future: Deduplication in sync server

### Missing worklogs from Jira

**Cause:**
- Webhook not configured
- Webhook failed (check Jira webhook logs)

**Fix:**
- Configure Jira webhook (see above)
- Re-trigger: Edit worklog in Jira (saves → sends webhook)

## Best Practices

1. **Set TRACT_SYNC_SERVER globally** - Avoid forgetting
2. **Check sync status after logging** - Confirm ✓ or ⚠️
3. **Push daily** - Don't let queue build up
4. **Monitor Jira** - Verify worklogs appear
5. **Check webhook health** - Jira → Settings → Webhooks → View logs
6. **Use consistent author names** - Match Jira usernames exactly

## Future Enhancements

- Edit/delete sync (bi-directional)
- Conflict detection and resolution UI
- Sync status dashboard
- Retry failed queue items automatically
- Real-time sync (websocket instead of polling)
