# Site Feature Enhancements — User Guide

This guide covers the seven features added by the **site-feature-enhancements** spec:
Server Comparison View, Restart Prediction Accuracy, Capacity / "Best time to join",
Alerts & Notifications, Anomaly Detection, Streamer Pages, and Historical Wrapped / Insights.

Each feature ships behind its own feature flag and is **disabled by default**. Enable a
flag from the admin features page (`/admin/features`); changes propagate to the site within
about 30 seconds without a redeploy.

> Note: Most new pages do not have navigation links yet — they are reached by URL.
> Where that matters, it is called out below.

---

## Quick reference

| Feature | Flag | Where to access |
|---|---|---|
| Server Comparison View | `comparison_view` | `/compare` |
| Restart Prediction Accuracy | `prediction_accuracy` | Predictions tab (server management) |
| Capacity / Best time to join | `capacity_advisor` | Server stats card (automatic) |
| Alerts & Notifications | `alerts` | `/alerts` (sign-in required) |
| Anomaly Detection (admin) | — (always on) | `/admin/monitoring` |
| Anomaly Detection (public) | `anomaly_public` | Server stats card (automatic) |
| Streamer Pages | `streamer_pages` | `/streamers/{platform}/{username}` |
| Historical Wrapped / Insights | `insights_wrapped` | `/wrapped`, `/wrapped/{YYYY-MM}` |

---

## Server Comparison View

- **Flag:** `comparison_view`
- **Access:** go to `/compare`

**How to use**
1. Pick 2 to 4 servers from the dropdown to pin them.
2. View an overlaid player-count chart plus a stat card for each server showing the current
   count, peak, peak time, and the next predicted restart.
3. Change the time range to recompute the chart and stats for the pinned set.
4. Remove a server with the × on its chip. The remaining servers are retained.

**Notes**
- Signed-in users have their pinned set saved automatically.
- Anonymous users keep the pinned set in the URL, so the link is shareable.
- Each server has a consistent color across the chart and its stat card.

---

## Restart Prediction Accuracy

- **Flag:** `prediction_accuracy`
- **Access:** the existing predictions tab (server management / predictions area).

**How to use**
- Nothing to configure. When enabled, a "Prediction Accuracy" card appears above the
  prediction details, showing the rolling 7-day accuracy and confidence levels.

**Notes**
- It shows **"Accuracy not yet available"** until the prediction-recording job has captured
  predictions and matched them against real restarts over time. This is expected on first
  launch — it fills in as data accumulates.

---

## Capacity / "Best time to join"

- **Flag:** `capacity_advisor`
- **Access:** appears automatically inside each server's stats card.

**How to use**
- Shows a recommended join window in **your local time zone**, plus a "currently full /
  near-full" indicator when the server is at or near capacity.

**Notes**
- Shows **"not yet available"** until there is at least 7 days of capacity history for that
  server.

---

## Alerts & Notifications

- **Flag:** `alerts` (also requires VAPID environment variables and the alerts cron — see Setup)
- **Access:** go to `/alerts` — **you must be signed in** (a sign-in prompt appears otherwise).

**How to use**
1. Click **Enable notifications** and grant the browser permission. This registers your
   device for web-push.
2. Create an alert:
   - **Player count below threshold** — pick a server and a number.
   - **Streamer goes live** — enter a username and pick Twitch or Kick.
3. Manage your alerts in the list: toggle them on/off or delete them.

**Notes**
- A notification fires once when the condition first becomes true (a "cleared → met"
  transition) and won't repeat until the condition clears and triggers again.
- Clicking a notification deep-links you back into the site.
- If a device's push subscription expires, it is deactivated automatically and skipped.

---

## Anomaly Detection

Anomaly detection flags unusual spikes and drops in a server's player count.

### Admin view
- **Access:** `/admin/monitoring`
- **How to use:**
  - The **Detected Anomalies** list shows recent spikes/drops with observed vs. expected
    values, deviation %, direction, and timestamp.
  - The **Anomaly Detection Thresholds** card lets you tune the deviation %, minimum absolute
    change, and the dedup window, then save.
- **Notes:** requires the anomaly cron to be running to populate data.

### Public view
- **Flag:** `anomaly_public`
- **Access:** when enabled, recent anomalies render automatically on each server's stats card.
- **Notes:** renders nothing when a server has no recent anomalies, to keep the card clean.

---

## Streamer Pages

- **Flag:** `streamer_pages`
- **Access:** `/streamers/{platform}/{username}`
  - Examples: `/streamers/twitch/summit1g`, `/streamers/kick/someuser`

**What you see**
- Display name, current live status and viewer count.
- The servers the streamer has been observed playing on.
- Clip history.
- A viewer-count trend with a selectable time range.
- Both Twitch and Kick identities if the streamer is on both platforms.

**Notes**
- Shows **"No data available"** for a streamer with no recorded history.
- When the flag is off, the page returns a 404 (it is gated on the server).
- Live status is best-effort (based on recent stream activity), so it can lag reality by a
  few minutes.

---

## Historical Wrapped / Insights

- **Flag:** `insights_wrapped` (also requires the insights cron — see Setup)
- **Access:**
  - `/wrapped` — the list of retained monthly reports.
  - `/wrapped/{YYYY-MM}` — a single month, e.g. `/wrapped/2026-04`.

**What you see**
- Each report highlights the peak-activity day, busiest server, and biggest mover
  (largest month-over-month growth).
- Metrics that can't be computed show an explicit "Not enough data" label rather than a
  wrong value.

**Sharing**
- The month page (`/wrapped/{YYYY-MM}`) is the public, shareable link and includes a copy
  button. Opening it renders the same report for any visitor.
- It generates an Open Graph / Twitter preview image for social sharing.

**Notes**
- The **first report appears only after a calendar month completes** and the insights cron
  has run. Reports are immutable once generated and retained for browsing.

---

## Setup prerequisites (admin / ops)

These features depend on configuration outside the UI:

1. **Database migrations** — run the new schema files in `api2db/sql/` (the comparison,
   alert, push, notification-deliveries, anomaly, recorded-predictions, and insights tables,
   plus the feature-flag seed). Run the alert/push tables before notification_deliveries.
2. **Dependencies** — run `npm install` (adds `web-push`).
3. **Environment variables (Alerts only)** — generate a VAPID keypair
   (`npx web-push generate-vapid-keys`) and set `VAPID_PUBLIC_KEY`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value), `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
   (a `mailto:` or URL). `CRON_SECRET` is reused from the existing monitoring cron.
4. **Scheduled jobs** — point your external scheduler at these routes with `?secret=CRON_SECRET`:

   | Route | Suggested cadence | Feature |
   |---|---|---|
   | `/api/cron/alerts` | ~2 min | Alert delivery |
   | `/api/cron/anomaly` | ~5 min | Anomaly detection |
   | `/api/cron/record-predictions` | ~15 min | Prediction accuracy |
   | `/api/cron/insights` | daily | Monthly Wrapped (idempotent) |

5. **Enable flags** — from `/admin/features`, turn on each feature when you're ready to roll
   it out: `comparison_view`, `prediction_accuracy`, `capacity_advisor`, `alerts`,
   `anomaly_public`, `streamer_pages`, `insights_wrapped`.

---

## Troubleshooting

- **A page 404s or doesn't appear** — its feature flag is off, or (for streamer pages) the
  URL platform isn't `twitch`/`kick`. Enable the flag in `/admin/features` and wait ~30s.
- **Accuracy / anomalies / Wrapped look empty** — the relevant cron hasn't run long enough
  yet. Confirm the scheduler is hitting the route with the correct `?secret=`.
- **"Enable notifications" does nothing** — confirm the VAPID env vars are set (including
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`), that you're signed in, and that the browser supports and
  was granted notification permission.
- **No nav links** — `/compare`, `/alerts`, `/streamers/...`, and `/wrapped` are reached by
  URL; navigation entries have not been added yet.
