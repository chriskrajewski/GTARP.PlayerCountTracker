# GTA RP Player and Viewer Count Tracker

Check it out at https://fivemstats.krtech.io

## How to build and run!

- Create your Supabase schema from api2db/sql/sqlSetup.sql

- Use api2db/edgeFunction to ingest data into Supabase via Supabase Edge Functions on a cron job

- Fill in your SUPABASE_URL, SUPABASE_KEY, TWITCH_CLIENT, and TWITCH_CLIENT_SECRET in your .env

- Run ``` vercel dev ``` if using vercel or ``` next build ``` and ``` next start ```
 
