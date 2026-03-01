# Read Receipts Workflows (n8n)

Build these as two separate workflows in n8n. This matches the existing `dashboard/*` pattern used in this repo.

## Workflow A: GET `dashboard/read-receipts-v2`

1. Add `Webhook` node:
- `HTTP Method`: `GET`
- `Path`: `dashboard/read-receipts-v2`
- `Response Mode`: `Response Node`

2. Add `IF` node:
- Condition expression:
```js
{{ $json.query.chatUserIds !== undefined }}
```

3. True branch (`chatUserIds` batch):
- Add `Code` node:
```js
const ids = ($input.first().json.query.chatUserIds || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

return [{ json: { ids } }];
```
- Add `MongoDB` node (`Find`):
  - `Collection`: `read_receipts`
  - `Filter`:
```js
{{ { "chatUserId": { "$in": $json.ids } } }}
```

4. False branch (`chatUserId` single):
- Add `MongoDB` node (`Find`):
  - `Collection`: `read_receipts`
  - `Filter`:
```js
{{ { "chatUserId": $json.query.chatUserId } }}
```

5. Add `Respond to Webhook` node:
- `Respond With`: `All Incoming Items`
- `Response Headers`:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Headers: Content-Type, x-api-key`
  - `Access-Control-Allow-Methods: GET, OPTIONS`

Connect both MongoDB branches to the same `Respond to Webhook` node.

Expected response shape:
```json
[
  {
    "chatUserId": "whatsapp:+96170XXXXXX",
    "reviewerName": "charbel",
    "lastReadDatetime": "2026-02-25T14:30:00Z",
    "markedAt": "2026-02-25T15:00:00Z"
  }
]
```

## Workflow B: POST `dashboard/read-receipts-v2` (upsert)

1. Add `Webhook` node:
- `HTTP Method`: `POST`
- `Path`: `dashboard/read-receipts-v2`
- `Response Mode`: `Response Node`

2. Add `Code` node (`Build Read Receipt Upsert`) before MongoDB:
```js
const body = $input.first().json.body || {};

const chatUserId = String(body.chatUserId || "").trim();
const reviewerName = String(body.reviewerName || "").trim().toLowerCase();
const lastReadDatetime = String(body.lastReadDatetime || "").trim();
const markedAt = String(body.markedAt || "").trim() || new Date().toISOString();

if (!chatUserId || !reviewerName || !lastReadDatetime) {
  throw new Error("chatUserId, reviewerName, and lastReadDatetime are required");
}

const id = `${chatUserId}::${reviewerName}`;

return [{
  json: {
    id,
    chatUserId,
    reviewerName,
    lastReadDatetime,
    markedAt,
  },
}];
```

3. Add `MongoDB` node (`Update`) using the newer `Document` UI:
- `Resource`: `Document`
- `Operation`: `Update`
- `Collection`: `read_receipts`
- `Update Key`: `id`
- `Fields`: `id,chatUserId,reviewerName,lastReadDatetime,markedAt`
- `Upsert`: enabled

4. Add `Respond to Webhook` node:
- `Respond With`: `JSON`
- `Response Body`:
```json
{ "success": true }
```
- `Status Code`: `200`
- `Response Headers`:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Headers: Content-Type, x-api-key`
  - `Access-Control-Allow-Methods: POST, OPTIONS`

## Quick smoke tests

```bash
# POST upsert
curl -X POST "https://YOUR_N8N/webhook/dashboard/read-receipts-v2" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{
    "chatUserId":"whatsapp:+96170XXXXXX",
    "reviewerName":"charbel",
    "lastReadDatetime":"2026-02-25T14:30:00.000Z",
    "markedAt":"2026-02-25T15:00:00.000Z"
  }'

# GET single
curl "https://YOUR_N8N/webhook/dashboard/read-receipts-v2?chatUserId=whatsapp:+96170XXXXXX" \
  -H "x-api-key: YOUR_KEY"

# GET batch
curl "https://YOUR_N8N/webhook/dashboard/read-receipts-v2?chatUserIds=whatsapp:+96170XXXXXX,whatsapp:+96111YYYYYY" \
  -H "x-api-key: YOUR_KEY"
```
