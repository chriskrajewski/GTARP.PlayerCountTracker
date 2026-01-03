-- Database views for clips aggregations
-- Provides efficient access to clip statistics

-- Aggregated clip counts per server
create or replace view clip_count_by_server as
select 
  "serverId",
  count(*) as total_clips,
  count(*) filter (where is_valid = true) as valid_clips,
  count(distinct streamer_username) as unique_streamers,
  sum(view_count) as total_views
from twitch_clips
group by "serverId";

-- Top streamers by clip count for each server
create or replace view top_clip_streamers as
select 
  "serverId",
  streamer_username,
  count(*) as clip_count,
  sum(view_count) as total_views,
  max(twitch_created_at) as latest_clip_date
from twitch_clips
where is_valid = true
group by "serverId", streamer_username
order by "serverId", clip_count desc;

-- View for clips needing validation
create or replace view clips_needing_validation as
select 
  id,
  clip_id,
  embed_url,
  last_validated_at
from twitch_clips
where is_valid = true
  and (last_validated_at is null or last_validated_at < now() - interval '24 hours')
order by last_validated_at asc nulls first
limit 1000;
