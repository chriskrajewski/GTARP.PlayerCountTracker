import { UrlAssertionBuilder, UrlMonitor } from 'checkly/constructs'

const BASE_URL =
  process.env.PLAYER_TRACKER_BASE_URL?.replace(/\/$/, '') ??
  'https://rpstats.com'

new UrlMonitor('homepage-availability', {
  name: 'Homepage availability',
  activated: true,
  maxResponseTime: 7000,
  degradedResponseTime: 4000,
  request: {
    url: `${BASE_URL}/`,
    followRedirects: true,
    assertions: [
      UrlAssertionBuilder.statusCode().equals(200),
    ],
  },
  tags: ['website', 'availability'],
})
