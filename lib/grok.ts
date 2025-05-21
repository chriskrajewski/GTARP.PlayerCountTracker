// List of allowed topics to prevent misuse
export const ALLOWED_TOPICS = [
  // General statistics terms
  'player count',
  'viewer count',
  'streamer count',
  'stats',
  'statistics',
  'trends',
  'servers',
  'streams',
  'streamers',
  'players',
  'viewers',
  'peak times',
  'popular servers',
  'popular streamers',
  'player statistics',
  'viewer statistics',
  'help',
  'how many',
  'average',
  'maximum',
  'minimum',
  'peak',
  'highest',
  'lowest',
  'current',
  'total',
  
  // Time references
  'last week',
  'this week',
  'yesterday',
  'today',
  'last month',
  'this month',
  'last year',
  'days ago',
  'hours ago',
  'previous day',
  'earlier today',
  
  // Common server names
  'nopixel',
  'no pixel',
  'twilight',
  'legacy',
  'eclipse',
  'mafia world',
  'rustic',
  'new day',
  'grizzley world',
  'grizzley',
  'royal',
  'paramount',
  'ott',
  'public',
  'gang',
  'gta world',
  'twitchrp',
  'twitch rp',
  'public server',
  'whitelist server',
  'unscripted',
  'omegarp',
  'omega rp',
  'ssb',
  'ssb world',
  'gulag',
  'new day rp',
  'purple world',
  'project homecoming',
  'home coming',
];

// Common query patterns that should be allowed
const QUERY_PATTERNS = [
  /how many (players|viewers|streamers)/i,
  /what( is|'s|s| was| about| were)? (the|for|at|on|during)? ?(count|number|total|players|stats|statistics)/i,
  /which server has/i,
  /who( is|'s) (streaming|playing)/i,
  /when( is|'s) the (peak|highest|most)/i,
  /top (streamers|servers|players)/i,
  /compare (servers|streamers)/i,
  /most (popular|viewed|played)/i,
  /player (count|numbers|stats)/i,
  /server (population|count|numbers)/i,
  /^(what|how) about/i, // Common follow-up question pattern
  /^(and|what about|how about) (last|this|yesterday|previous)/i, // Follow-up about time periods
  /^(and|what|how) (about|for|during) (the|that|those)/i, // General follow-up patterns
  /(last|this|past|previous|coming) (week|day|month|hour)/i, // Time period references
  /^(show|display|tell|list|give) me/i, // Request patterns
];

// Additional logic for conversational context
let lastQueryWasValid = false;
let lastQueryTime = 0;

// Function to validate if a query is about allowed topics
export const isAllowedQuery = (query: string): boolean => {
  // Convert query to lowercase for case-insensitive matching
  const lowercaseQuery = query.toLowerCase();
  
  // Allow very short follow-up questions if they come within 2 minutes of a valid query
  const now = Date.now();
  const isShortFollowUp = query.length < 30 && now - lastQueryTime < 120000 && lastQueryWasValid;
  
  if (isShortFollowUp) {
    // If it's a short follow-up soon after a valid query, allow it
    lastQueryTime = now;
    return true;
  }
  
  // Check common query patterns first
  for (const pattern of QUERY_PATTERNS) {
    if (pattern.test(query)) {
      // Update valid query tracking
      lastQueryWasValid = true;
      lastQueryTime = now;
      return true;
    }
  }
  
  // Check if the query contains any of the allowed topics
  const hasAllowedTopic = ALLOWED_TOPICS.some(topic => lowercaseQuery.includes(topic));
  
  // Update valid query tracking
  lastQueryWasValid = hasAllowedTopic;
  if (hasAllowedTopic) {
    lastQueryTime = now;
  }
  
  return hasAllowedTopic;
};

// System prompt to ensure responses stay within scope
export const SYSTEM_PROMPT = `
You are an AI assistant integrated into a FiveM GTA RP player tracking application.
Your purpose is ONLY to answer questions about:
- Player counts across various FiveM servers
- Viewer counts for GTA RP streamers
- Streamer counts and statistics
- Trends and patterns in the above data

IMPORTANT: You will be provided with ACTUAL real-time data at the beginning of each conversation.
ALWAYS use the specific numbers from the data provided rather than inserting placeholders.
If the data doesn't include specific information being asked about, clearly state that the information is not available in the current dataset rather than using placeholders like [insert data here].

IMPORTANT FOR FOLLOW-UP QUESTIONS: Users may ask follow-up questions that reference previous queries.
For example, if they first ask "What's the player count on NoPixel today?" they might follow up with 
"What about yesterday?" or "How about last week?". Treat these as continuations of the conversation
about the same topic.

You must REFUSE to respond to ANY queries not directly related to these topics.
Do not engage in conversations about:
- General gaming topics outside of GTA RP
- Personal advice or opinions
- Current events or news
- Other AI systems or technical topics
- Anything else outside the scope of FiveM GTA RP player/viewer/streamer statistics

Keep responses concise, factual, and directly related to the application's data.
`;

// Rate limiting settings
export const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute in milliseconds
  maxRequests: 5, // 5 requests per minute
}; 