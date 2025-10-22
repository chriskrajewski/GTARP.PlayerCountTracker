import { ApiCheck, AssertionBuilder } from 'checkly/constructs'

const BASE_URL =
  process.env.PLAYER_TRACKER_BASE_URL?.replace(/\/$/, '') ??
  'https://fivemstats.krtech.io'

new ApiCheck('changelog-api', {
  name: 'Changelog API responds with commits payload',
  request: {
    url: `${BASE_URL}/api/changelog`,
    method: 'GET',
    headers: [
      {
        key: 'User-Agent',
        value: 'checkly-monitor',
      },
    ],
    followRedirects: true,
    skipSSL: false,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.commits').isNotNull(),
      AssertionBuilder.textBody().contains('"commits"'),
    ],
  },
  degradedResponseTime: 5000,
  maxResponseTime: 10000,
  tags: ['api', 'changelog'],
})

new ApiCheck('notification-banners-api', {
  name: 'Notification banners API returns banner list',
  request: {
    url: `${BASE_URL}/api/notification-banners`,
    method: 'GET',
    headers: [
      {
        key: 'User-Agent',
        value: 'checkly-monitor',
      },
    ],
    followRedirects: true,
    skipSSL: false,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.banners').isNotNull(),
      AssertionBuilder.jsonBody('$.total').isNotNull(),
    ],
  },
  degradedResponseTime: 5000,
  maxResponseTime: 10000,
  tags: ['api', 'notifications'],
})

const REFRESH_THRESHOLD_MINUTES = Number.parseInt(
  process.env.PLAYER_TRACKER_REFRESH_THRESHOLD_MINUTES ?? '20',
  10,
)

const REFRESH_THRESHOLD =
  Number.isNaN(REFRESH_THRESHOLD_MINUTES) || REFRESH_THRESHOLD_MINUTES < 1
    ? 20
    : REFRESH_THRESHOLD_MINUTES

new ApiCheck('refresh-latency-health', {
  name: `Data refresh latency stays under ${REFRESH_THRESHOLD} minutes`,
  request: {
    url: `${BASE_URL}/api/status/refresh`,
    method: 'GET',
    followRedirects: true,
    skipSSL: false,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody('$.success').equals(true),
      AssertionBuilder.jsonBody('$.staleCount').equals(0),
      AssertionBuilder.jsonBody('$.thresholdMinutes').equals(
        REFRESH_THRESHOLD,
      ),
    ],
  },
  degradedResponseTime: 5000,
  maxResponseTime: 10000,
  tags: ['api', 'refresh'],
})
