# Requirements Document

## Introduction

This document defines requirements for a batch of seven related feature enhancements to RPStats.com, a real-time GTA RP server tracking and analytics platform built on Next.js (App Router), TypeScript, and a PostgreSQL data layer currently served by Supabase. These features extend the existing platform with comparison, personalization, notification, and analytics capabilities driven primarily from the existing player-count time-series data.

The seven features are delivered behind the existing feature-flag system so each can be enabled, disabled, or rolled out independently. They are organized into three priority phases:

- **Phase 1 (P1):** Server Comparison View, Restart Prediction Accuracy Tracking, Capacity/Queue Insights
- **Phase 2 (P2):** User Alerts/Notifications, Anomaly Detection
- **Phase 3 (P3):** Streamer-Centric Pages, Historical Wrapped/Insights

### Migration Awareness

The data layer is undergoing an in-flight migration from Supabase to AWS RDS PostgreSQL with Prisma ORM (see `.kiro/specs/supabase-to-prisma-rds-migration`). To avoid rework and conflicts, all new data-access code introduced by these features routes through the shared data-access abstraction in `lib/` (for example `lib/data.ts`) rather than calling a database client directly, so the underlying client can change without altering feature logic. New persisted tables are specified in client-agnostic terms (table shape, columns, indexes) so they can be expressed in either Supabase SQL or a Prisma schema.

### Scope Boundaries

- Each feature is gated behind a dedicated feature flag registered in the existing feature-flag system.
- The `how` of implementation (specific components, ORM choice, ML model selection) is deferred to the design document.
- Where a feature depends on data that is not currently collected, the requirement specifies the data dependency explicitly.

## Glossary

- **Platform**: The RPStats.com web application as a whole.
- **Comparison_View**: The feature that displays 2 to 4 user-selected servers side by side with overlaid charts and summary statistics.
- **Pinned_Server**: A server a user has selected for inclusion in the Comparison_View.
- **Alert_System**: The subsystem that lets authenticated users create alert subscriptions and that delivers notifications when subscription conditions are met.
- **Alert_Subscription**: A user-defined rule describing a condition (for example a player-count threshold or a streamer going live) that, when met, triggers a notification.
- **Web_Push_Service**: The browser web-push delivery mechanism layered on the existing PWA service worker (`public/sw.js`).
- **Push_Subscription**: A browser-provided push endpoint and key set, stored per user, used to deliver web-push notifications.
- **Streamer_Profile**: The dedicated page for a single streamer showing their servers, clip history, live status, and viewer trends.
- **Insights_Report**: A generated monthly recap ("wrapped") summarizing notable statistics over a calendar month.
- **Restart_Predictor**: The existing restart-prediction subsystem (`lib/restart-prediction.ts` and the predictions tab).
- **Prediction_Accuracy_Tracker**: The subsystem that records past restart predictions, compares them against observed restarts, and computes accuracy metrics.
- **Anomaly_Detector**: The subsystem that flags unusual drops or spikes in player-count time-series data.
- **Capacity_Advisor**: The subsystem that produces a "best time to join" recommendation per server from historical capacity, player-count, and queue data.
- **App_User**: An authenticated end user with a record in the `app_users` store (distinct from an admin user).
- **Admin_User**: An authenticated user with administrative privileges over the Platform.
- **Feature_Flag_System**: The existing flag system (`lib/feature-flags.ts`, admin features page) used to gate features.
- **Data_Layer**: The shared data-access abstraction in `lib/` through which all feature database access is routed.
- **Player_Count_Series**: The historical time-series of player counts per server stored in the `player_counts` data.
- **Server**: A tracked GTA RP server identified by a stable server identifier.

## Requirements

### Requirement 1: Feature Flag Gating

**User Story:** As an Admin_User, I want each new feature gated behind its own flag, so that I can roll features out or disable them independently without redeploying.

#### Acceptance Criteria

1. THE Feature_Flag_System SHALL define one distinct flag for each of the following features: Comparison_View, Alert_System, Streamer_Profile pages, Insights_Report, Prediction_Accuracy_Tracker, Anomaly_Detector public surfacing, and Capacity_Advisor.
2. WHERE a feature flag is disabled, THE Platform SHALL hide that feature's navigation entries, pages, and UI surfaces from App_Users.
3. WHEN an Admin_User toggles a feature flag, THE Platform SHALL apply the new flag state to App_User-facing surfaces within 30 seconds without requiring a redeploy.
4. IF a feature flag value cannot be retrieved, THEN THE Platform SHALL treat that feature as disabled for App_User-facing surfaces.

### Requirement 2: Server Comparison View

**User Story:** As a community member, I want to pin 2 to 4 servers and view them side by side, so that I can quickly tell which server is most active right now.

#### Acceptance Criteria

1. WHEN an App_User selects between 2 and 4 servers to pin, THE Comparison_View SHALL display an overlaid player-count chart containing one series per Pinned_Server.
2. IF an App_User attempts to pin more than 4 servers, THEN THE Comparison_View SHALL prevent the additional selection and display a message stating the 4-server maximum.
3. IF fewer than 2 servers are pinned, THEN THE Comparison_View SHALL display a prompt instructing the App_User to pin at least 2 servers.
4. WHEN the Comparison_View renders for a set of Pinned_Servers, THE Comparison_View SHALL display, for each Pinned_Server, the current player count, the peak player count, and the peak time over the selected time range.
5. WHEN the Comparison_View renders for a set of Pinned_Servers, THE Comparison_View SHALL display each Pinned_Server's next predicted restart time as provided by the Restart_Predictor.
6. WHEN an App_User changes the selected time range, THE Comparison_View SHALL recompute and redisplay all charts and summary statistics for the currently Pinned_Servers using the new time range.
7. WHEN an App_User removes a Pinned_Server, THE Comparison_View SHALL remove that server's series and statistics and retain the remaining Pinned_Servers.
8. THE Comparison_View SHALL assign each Pinned_Server a visually distinct color that is consistent between the chart series and the corresponding summary statistics.

### Requirement 3: User Alerts and Notifications

**User Story:** As an App_User, I want to subscribe to alerts about server population and streamer activity, so that I am notified when something I care about happens without watching the site.

#### Acceptance Criteria

1. WHILE an App_User is authenticated, THE Alert_System SHALL allow the App_User to create an Alert_Subscription of type "player count below threshold" specifying a target Server and an integer threshold.
2. WHILE an App_User is authenticated, THE Alert_System SHALL allow the App_User to create an Alert_Subscription of type "streamer live" specifying a target streamer.
3. IF an unauthenticated visitor attempts to create an Alert_Subscription, THEN THE Alert_System SHALL deny the request and prompt the visitor to sign in.
4. WHEN an App_User chooses to enable web-push delivery, THE Web_Push_Service SHALL request browser notification permission and, on grant, store the resulting Push_Subscription associated with the App_User.
5. WHEN a target Server's most recent player count transitions from at or above an Alert_Subscription threshold to below that threshold, THE Alert_System SHALL deliver a notification to the subscribing App_User.
6. WHEN a target streamer transitions from offline to live, THE Alert_System SHALL deliver a notification to each App_User with a matching "streamer live" Alert_Subscription.
7. WHEN an Alert_Subscription condition is met, THE Alert_System SHALL deliver at most one notification per subscription per condition-trigger and SHALL suppress repeat notifications until the condition has cleared and re-triggered.
8. WHILE an App_User is authenticated, THE Alert_System SHALL allow the App_User to view, edit, and delete the App_User's own Alert_Subscriptions.
9. IF web-push delivery to a stored Push_Subscription fails because the subscription is expired or invalid, THEN THE Alert_System SHALL mark that Push_Subscription as inactive and stop attempting delivery to it.
10. WHEN a notification is delivered, THE Alert_System SHALL record the delivery with a timestamp, the associated Alert_Subscription, and the delivery outcome.

### Requirement 4: Streamer-Centric Pages

**User Story:** As a viewer, I want a dedicated page for a streamer, so that I can see which servers they play, their clips, their live status, and their viewer trends in one place.

#### Acceptance Criteria

1. WHEN an App_User navigates to a Streamer_Profile for a known streamer, THE Streamer_Profile SHALL display the streamer's display name, platform, and current live status.
2. WHEN a Streamer_Profile renders, THE Streamer_Profile SHALL display the list of Servers the streamer has been observed playing on, derived from the streamer-server history data.
3. WHEN a Streamer_Profile renders, THE Streamer_Profile SHALL display the streamer's clip history sourced from the existing clips data.
4. WHILE a streamer is live, THE Streamer_Profile SHALL display the streamer's current viewer count.
5. WHEN a Streamer_Profile renders, THE Streamer_Profile SHALL display the streamer's historical viewer-count trend over a selectable time range.
6. IF an App_User navigates to a Streamer_Profile for a streamer with no recorded history, THEN THE Streamer_Profile SHALL display a message stating that no data is available for that streamer.
7. WHERE a streamer is associated with both Twitch and Kick identities, THE Streamer_Profile SHALL indicate each platform identity and its individual live status.

### Requirement 5: Historical Wrapped and Insights

**User Story:** As a community member, I want a shareable monthly recap of server activity, so that I can see and share the month's highlights.

#### Acceptance Criteria

1. WHEN a calendar month completes, THE Platform SHALL generate an Insights_Report for that month from the Player_Count_Series.
2. THE Insights_Report SHALL include the peak-activity day of the month, the busiest Server of the month, and the Server with the largest month-over-month growth.
3. IF the Player_Count_Series contains insufficient data to compute a metric in the Insights_Report, THEN THE Platform SHALL omit that metric and label it as unavailable rather than displaying an incorrect value.
4. WHEN an App_User views an Insights_Report, THE Platform SHALL provide a shareable link that renders the same Insights_Report for any visitor who opens the link.
5. WHEN an Insights_Report is generated, THE Platform SHALL produce a shareable image or preview suitable for social sharing of that report.
6. THE Platform SHALL retain each generated Insights_Report so that previously generated monthly reports remain viewable.

### Requirement 6: Restart Prediction Accuracy Tracking

**User Story:** As a community member, I want to see how accurate the restart predictions have been, so that I can judge how much to trust the next predicted restart.

#### Acceptance Criteria

1. WHEN the Restart_Predictor produces a restart prediction for a Server, THE Prediction_Accuracy_Tracker SHALL record the predicted restart time, the prediction's confidence value, and the time the prediction was made.
2. WHEN a restart event is detected for a Server, THE Prediction_Accuracy_Tracker SHALL match the detected restart against the most recent applicable recorded prediction and record the difference between predicted and observed restart times in minutes.
3. THE Prediction_Accuracy_Tracker SHALL compute, over a rolling 7-day window, the proportion of recorded predictions whose observed restart occurred within a defined tolerance of the predicted time.
4. WHEN an App_User views the predictions tab, THE Platform SHALL display the rolling 7-day accuracy metric for restart predictions.
5. WHEN the Restart_Predictor displays a prediction for a Server, THE Platform SHALL display a confidence interval or confidence level alongside the predicted restart time.
6. IF no predictions have been recorded within the rolling 7-day window, THEN THE Platform SHALL display that accuracy is not yet available rather than displaying a zero or misleading value.

### Requirement 7: Anomaly Detection

**User Story:** As an Admin_User and as a community member, I want unusual drops and spikes flagged, so that server issues or notable events are surfaced promptly.

#### Acceptance Criteria

1. WHEN new player-count data is evaluated for a Server, THE Anomaly_Detector SHALL classify a data point as anomalous when the player count deviates from the Server's expected value for that time by more than a configured threshold.
2. WHEN the Anomaly_Detector classifies a data point as an anomalous drop, THE Anomaly_Detector SHALL record an anomaly record containing the Server identifier, the timestamp, the observed value, the expected value, and the anomaly direction.
3. WHEN the Anomaly_Detector classifies a data point as an anomalous spike, THE Anomaly_Detector SHALL record an anomaly record containing the Server identifier, the timestamp, the observed value, the expected value, and the anomaly direction.
4. WHEN an anomaly is recorded, THE Platform SHALL surface that anomaly in the admin monitoring view.
5. WHERE public anomaly surfacing is enabled, THE Platform SHALL display recorded anomalies for a Server on that Server's public-facing surfaces.
6. WHEN the Anomaly_Detector records an anomaly for the same Server and direction that is already active within a configured deduplication window, THE Anomaly_Detector SHALL suppress the duplicate rather than creating a new record.
7. THE Anomaly_Detector SHALL expose its detection thresholds as configuration values adjustable by an Admin_User.

### Requirement 8: Capacity and Queue Insights

**User Story:** As a community member, I want a "best time to join" recommendation for a server, so that I can play when queues are shortest and slots are available.

#### Acceptance Criteria

1. WHEN an App_User views a Server that has historical capacity data, THE Capacity_Advisor SHALL display a recommended time window to join based on historical player count relative to maximum capacity.
2. THE Capacity_Advisor SHALL compute the recommended join window from the Server's historical Player_Count_Series and server capacity data over a rolling analysis window of at least 7 days.
3. WHERE a Server provides queue data, THE Capacity_Advisor SHALL incorporate historical queue length into the recommended join window.
4. WHEN the Capacity_Advisor displays a recommendation, THE Capacity_Advisor SHALL present the recommended time window in the viewing App_User's local time zone.
5. IF a Server has insufficient historical capacity data to compute a recommendation, THEN THE Capacity_Advisor SHALL display that a recommendation is not yet available for that Server.
6. WHILE a Server is currently at or near maximum capacity, THE Capacity_Advisor SHALL indicate that the Server is currently full or near-full in addition to the recommended join window.

### Requirement 9: Data Layer and Migration Compatibility

**User Story:** As a developer, I want all new data access to be migration-safe, so that the in-flight Supabase-to-Prisma/RDS migration is not disrupted by these features.

#### Acceptance Criteria

1. THE Data_Layer SHALL expose all database reads and writes introduced by these features through shared functions in `lib/` rather than direct database-client calls in pages or components.
2. WHERE a feature introduces a new persisted table, THE Platform SHALL define that table with explicit columns, types, and indexes that are expressible in both the current Supabase schema and a Prisma schema.
3. WHEN a feature reads existing time-series data, THE Data_Layer SHALL reuse existing data-access functions where one already provides the required data rather than introducing a parallel query path.
4. WHERE a new table stores per-App_User data, THE Platform SHALL enforce that an App_User can read and modify only that App_User's own rows.
