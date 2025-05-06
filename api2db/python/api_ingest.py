import requests
from supabase import create_client, Client
from datetime import datetime
import os
from http.server import BaseHTTPRequestHandler

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# FiveM API endpoint
API_URL = "https://servers-frontend.fivem.net/api/servers/single/o3re8y" # Replace with the serverid you want to query

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Set headers to mimic a browser request
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://servers.fivem.net/",
                "Origin": "https://servers.fivem.net"
            }
            
            # Make API request with headers
            response = requests.get(API_URL, headers=headers)
            response.raise_for_status()

            # Parse JSON response
            data = response.json()
            
            # Extract player count
            current_players = data.get("Data", {}).get("selfReportedClients", 0)

            # Get current timestamp
            timestamp = datetime.utcnow().isoformat()

            # Prepare data for Supabase
            record = {
                "timestamp": timestamp,
                "player_count": current_players,
                "server_id": "o3re8y" # Replace with the serverid you want to query
            }

            # Insert into Supabase
            supabase.table("player_counts").insert(record).execute()
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"[{timestamp}] Successfully saved player count: {current_players}".encode())

        except requests.RequestException as e:
            self.send_response(500)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"[{datetime.utcnow().isoformat()}] API request error: {str(e)}".encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"[{datetime.utcnow().isoformat()}] Unexpected error: {str(e)}".encode())