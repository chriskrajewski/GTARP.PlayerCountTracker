import os
import requests
import logging
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from time import sleep
from typing import List, Dict, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_environment_variables() -> Dict[str, str]:
    """Load environment variables from .env file."""
    load_dotenv()
    required_vars = {
        'TWITCH_CLIENT_ID': os.getenv('TWITCH_CLIENT_ID'),
        'TWITCH_CLIENT_SECRET': os.getenv('TWITCH_CLIENT_SECRET'),
        'SUPABASE_URL': os.getenv('SUPABASE_URL'),
        'SUPABASE_KEY': os.getenv('SUPABASE_KEY')
    }
    for var, value in required_vars.items():
        if not value:
            logger.error(f"Missing environment variable: {var}")
            raise ValueError(f"Environment variable {var} is not set")
    return required_vars

def get_twitch_oauth_token(client_id: str, client_secret: str) -> str:
    """Obtain OAuth token from Twitch API."""
    url = "https://id.twitch.tv/oauth2/token"
    params = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials"
    }
    try:
        response = requests.post(url, params=params)
        response.raise_for_status()
        return response.json().get("access_token")
    except requests.RequestException as e:
        logger.error(f"Failed to obtain Twitch OAuth token: {e}")
        raise

def get_game_id(client_id: str, token: str, game_name: str) -> Optional[str]:
    """Fetch game ID for the specified game name."""
    url = "https://api.twitch.tv/helix/games"
    headers = {
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}"
    }
    params = {"name": game_name}
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        games = data.get("data", [])
        if games:
            return games[0]["id"]
        logger.warning(f"No game found with name: {game_name}")
        return None
    except requests.RequestException as e:
        logger.error(f"Failed to fetch game ID for {game_name}: {e}")
        return None

def get_streams(client_id: str, token: str, game_id: str, keyword: str) -> List[Dict]:
    """Fetch streams for a game and filter by keyword in title."""
    url = "https://api.twitch.tv/helix/streams"
    headers = {
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}"
    }
    params = {
        "game_id": game_id,
        "first": 100  # Max per page
    }
    streams = []
    cursor = None

    while True:
        if cursor:
            params["after"] = cursor
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            for stream in data.get("data", []):
                if keyword.lower() in stream["title"].lower():
                    streams.append({
                        "streamer_name": stream["user_name"],
                        "stream_title": stream["title"],
                        "viewer_count": stream["viewer_count"],
                        "game_name": "Grand Theft Auto V",
                        "serverId": "o3re8y"
                    })
            cursor = data.get("pagination", {}).get("cursor")
            if not cursor:
                break
            sleep(0.5)  # Avoid rate limits
        except requests.RequestException as e:
            logger.error(f"Failed to fetch streams: {e}")
            break

    return streams

def log_to_supabase(supabase: Client, streams: List[Dict]) -> None:
    """Log stream data to Supabase."""
    if not streams:
        logger.info("No streams to log to Supabase")
        return

    try:
        for stream in streams:
            data = {
                "streamer_name": stream["streamer_name"],
                "stream_title": stream["stream_title"],
                "viewer_count": stream["viewer_count"],
                "game_name": stream["game_name"],
                "serverId": stream["serverId"]
            }
            supabase.table("twitch_streams").insert(data).execute()
        logger.info(f"Successfully logged {len(streams)} streams to Supabase")
    except Exception as e:
        logger.error(f"Failed to log to Supabase: {e}")

def main():
    """Main function to scrape Twitch and log to Supabase."""
    try:
        # Load environment variables
        env_vars = load_environment_variables()
        client_id = env_vars["TWITCH_CLIENT_ID"]
        client_secret = env_vars["TWITCH_CLIENT_SECRET"]
        supabase_url = env_vars["SUPABASE_URL"]
        supabase_key = env_vars["SUPABASE_KEY"]

        # Initialize Supabase client
        supabase = create_client(supabase_url, supabase_key)

        # Get Twitch OAuth token
        token = get_twitch_oauth_token(client_id, client_secret)

        # Get game ID for Grand Theft Auto V
        game_id = get_game_id(client_id, token, "Grand Theft Auto V")
        if not game_id:
            logger.error("Could not find game ID for Grand Theft Auto V")
            return

        # Fetch streams with "unscripted" in title
        streams = get_streams(client_id, token, game_id, "unscripted")
        logger.info(f"Found {len(streams)} streams with 'unscripted' in title")

        # Log to Supabase
        log_to_supabase(supabase, streams)

    except Exception as e:
        logger.error(f"An error occurred in main: {e}")

if __name__ == "__main__":
    main()