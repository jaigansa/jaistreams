import os
import time
import random
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- IMPORT THE OLLAMA FUNCTION ---
try:
    from ollama_api import get_gemma_response
except ImportError:
    print("FATAL: Could not import 'get_gemma_response'. Ensure ollama_gemma_api.py is in the same directory.")
    # Exit if the LLM helper is missing
    exit()

# --- CONFIGURATION ---
CLIENT_SECRET_FILE = 'client_secret.json'
TOKEN_FILE = 'token.json' 
# FIX: Use the correct scopes for reading and posting chat messages.
SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly', 
    'https://www.googleapis.com/auth/youtube' # REQUIRED for posting chat messages
]

# --- QUOTA FIX CONFIGURATION (6hr quota fix maintained) ---
# Enforces a minimum polling interval to stay within the 10,000 unit quota for a 6-hour stream.
MINIMUM_POLLING_INTERVAL_SEC = 12.0
# ----------------------------------

# --- BOT COMMAND CONFIGURATION ---
BOT_COMMAND = '!jai'


def get_authenticated_service():
    """Handles the OAuth 2.0 flow and returns the authorized YouTube API service."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        print("Token file found. Loading credentials...")
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing credentials...")
            creds.refresh(Request())
        else:
            print("Starting new authorization flow...")
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            # Use 'run_local_server' for desktop applications
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    # Build the authorized service object
    youtube = build('youtube', 'v3', credentials=creds)
    return youtube


def find_active_live_chat(youtube_service):
    """Finds the ID of the current active live stream and its chat ID (100 units)."""
    print("🔍 Searching for active live stream...")
    
    try:
        # FIX: Removed 'mine=True' to avoid conflict with 'broadcastStatus=active'
        broadcast_request = youtube_service.liveBroadcasts().list(
            part='snippet,contentDetails',
            broadcastStatus='active' # Finds the currently active stream
        )
        broadcast_response = broadcast_request.execute()

        if not broadcast_response.get('items'):
            print("❌ No active live broadcast found. Is your stream running?")
            return None

        broadcast = broadcast_response['items'][0]
        live_chat_id = broadcast['snippet']['liveChatId']
        
        print(f"✅ Found active stream: {broadcast['snippet']['title']}")
        return live_chat_id
        
    except HttpError as e:
        print(f"⚠️ Error finding live stream. Check your scopes or API usage limits: {e}")
        return None


def post_message(youtube_service, live_chat_id, message_text):
    """Sends a message back to the YouTube Live Chat (80 units)."""
    try:
        youtube_service.liveChatMessages().insert(
            part='snippet',
            body={
                'snippet': {
                    'liveChatId': live_chat_id,
                    'type': 'textMessageEvent',
                    'textMessageDetails': {
                        'messageText': message_text
                    }
                }
            }
        ).execute()
        print(f"-> Successfully posted: {message_text}") 
    except HttpError as e:
        # Error 403 or 404 most likely due to quota or invalid chat ID/permissions
        print(f"⚠️ Error posting message (check quota/scopes/permissions): {e}")


def run_chat_bot(youtube_service):
    """The main loop to read, process, and respond to chat messages."""
    
    live_chat_id = find_active_live_chat(youtube_service)
    if not live_chat_id:
        return

    # --- CHAT CATCH-UP & INITIALIZATION ---
    next_page_token = None
    polling_interval_sec = MINIMUM_POLLING_INTERVAL_SEC 
    
    # Reminder timer initialization REMOVED
    
    try:
        # Initial read to get the latest nextPageToken (maxResults=0 skips old messages). (5 units)
        initial_request = youtube_service.liveChatMessages().list(
            liveChatId=live_chat_id,
            part='snippet',
            maxResults=0 # SKIPS ALL OLD MESSAGES
        ).execute()
        
        next_page_token = initial_request.get('nextPageToken')
        initial_polling_ms = initial_request.get('pollingIntervalMillis', 5000)
        
        # Calculate the starting interval
        api_suggested_interval = initial_polling_ms / 1000
        polling_interval_sec = max(api_suggested_interval, MINIMUM_POLLING_INTERVAL_SEC)
        
        print(f"✅ Bot is caught up. Starting monitor with interval: {polling_interval_sec:.2f}s.")
    except HttpError as e:
        print(f"⚠️ Error during initial chat catch-up (using default {polling_interval_sec}s interval): {e}")
        pass 
    # -------------------------------
    
    try:
        while True:
            # === 1. REMINDER CHECK REMOVED ===
            # The logic to check and post a reminder is removed from this loop.

            # === 2. READ CHAT MESSAGES (5 units) ===
            request = youtube_service.liveChatMessages().list(
                liveChatId=live_chat_id,
                part='snippet,authorDetails',
                pageToken=next_page_token 
            )
            response = request.execute()
            
            # 🔑 CRITICAL QUOTA FIX: Enforce minimum polling interval
            polling_interval_ms = response.get('pollingIntervalMillis', 5000)
            api_suggested_interval = polling_interval_ms / 1000
            polling_interval_sec = max(api_suggested_interval, MINIMUM_POLLING_INTERVAL_SEC)
            
            next_page_token = response.get('nextPageToken') 

            for item in response.get('items', []):
                message_text = item['snippet']['displayMessage']
                author_name = item['authorDetails']['displayName']
                
                # Filter: Respond only to new BOT_COMMANDs
                if message_text.lower().startswith(BOT_COMMAND): 
                    question = message_text[len(BOT_COMMAND):].strip()
                    
                    print(f"\n💬 [{author_name}]: {message_text}")
                    
                    # Process message using Ollama/Gemma
                    response_text = get_gemma_response(question) 
                    
                    print(f"🤖 [Jai Response]: {response_text}")
                    
                    # Post the response back to YouTube (80 units)
                    post_message(youtube_service, live_chat_id, response_text)

            # === 3. DYNAMIC DELAY ===
            # Use the calculated interval, which is guaranteed to be >= 12 seconds
            print(f"💤 Waiting for {polling_interval_sec:.2f} seconds...")
            time.sleep(polling_interval_sec)

    except HttpError as e:
        print(f"\n❌ An HTTP error occurred (check API quotas/scopes): {e}")
        time.sleep(60) 
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
        time.sleep(60)


if __name__ == '__main__':
    print("--- YouTube Live Chat Bot Startup ---")
    
    # 1. Authorize
    youtube_service = get_authenticated_service()
    
    # 2. Start the main bot loop
    print("Starting bot loop...")
    run_chat_bot(youtube_service)