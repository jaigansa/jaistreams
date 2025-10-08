import os
import time
import random
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- CONFIGURATION ---
CLIENT_SECRET_FILE = 'client_secret.json'
TOKEN_FILE = 'token.json'
SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube'  # Required for posting chat messages
]

# --- REMINDER LIST & TIMING ---
# The messages to be posted sequentially in the live chat.
REMINDER_MESSAGES = [
    # Example style: English + Tamil Script
    "🔥 Thanks for tuning in guys! மறக்காம LIKE பண்ணிடுங்க!",

    # Engagement & Support
    "🔔 சேனலுக்குப் புதுசா இருந்தா, உடனே SUBSCRIBE பண்ணி அந்த Bell icon-அ அழுத்திடுங்க!",
    "💬 ஏதாவது doubt இருந்தா, இல்ல சும்மா ஒரு Hi சொல்லணும்னா, CHAT-ல போடுங்க!",
    "💰 நம்ம channel-அ support பண்ண நினைக்கிறவங்க, ஒரு Super Chat போட்டு எங்களை motivate பண்ணலாம்!",

    # Technical & Information
    "🔄 வீடியோ Quality கொஞ்சம் கம்மியா தெரிஞ்சா, செட்டிங்ஸ்ல போய் 1080p-க்கு மாத்திப் பாருங்க.",
    "🔗 இன்னைக்குரிய topic links அப்புறம் என்னோட social media links எல்லாமே description-ல இருக்கு, செக் பண்ணிக்கோங்க.",

    # Interaction & Feedback
    "We appreciate your support! முடிஞ்சா இந்த live-அ உங்க friends கூட share பண்ணுங்க!",
    "💡 Quick Poll ஒண்ணு போடலாமா? Yes இல்ல No-னு chat-ல சொல்லுங்க பார்ப்போம்!",
    "Pace எப்படி இருக்கு? நான் ரொம்ப fast-ஆ போறேனா, இல்ல slow-வா இருக்கா? ஒரு feedback குடுங்க!"
]

# Delay between posting each message in seconds (to avoid spamming/rate limits).
# Calculation: 6 minutes per message.
# This ensures a message is posted every 6 minutes.
DELAY_BETWEEN_POSTS_SEC = 360


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
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    youtube = build('youtube', 'v3', credentials=creds)
    return youtube


def find_active_live_chat(youtube_service):
    """Finds the ID of the current active live stream and its chat ID."""
    print("🔍 Searching for active live stream...")
    try:
        # Request broadcasts owned by 'mine' and filter for 'active' status
        broadcast_request = youtube_service.liveBroadcasts().list(
            part='snippet,contentDetails',
            #mine=True,
            broadcastStatus='active'
        )
        broadcast_response = broadcast_request.execute()

        if not broadcast_response.get('items'):
            print("❌ No active live broadcast found. Is your stream running and set to 'Live'?")
            return None

        # Assuming the first active broadcast is the one we want to chat in
        broadcast = broadcast_response['items'][0]
        live_chat_id = broadcast['snippet']['liveChatId']

        print(f"✅ Found active stream: {broadcast['snippet']['title']}")
        return live_chat_id

    except HttpError as e:
        print(f"⚠️ Error finding live stream: {e}")
        return None


def post_message(youtube_service, live_chat_id, message_text):
    """Sends a message to the YouTube Live Chat."""
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
        # Note: HTTP 403 (Forbidden) often means you are not authorized to post,
        # or the live chat is disabled/moderated.
        print(f"⚠️ Error posting message: {e}")


def post_reminders_from_list(youtube_service):
    """Iterates through the REMINDER_MESSAGES list and posts each one to the live chat with a delay, repeating indefinitely."""
    live_chat_id = find_active_live_chat(youtube_service)

    if not live_chat_id:
        # Only proceed if an active chat is found
        return

    print(f"\n🚀 Starting continuous reminder posting sequence for {len(REMINDER_MESSAGES)} messages.")

    cycle = 0
    message_count = len(REMINDER_MESSAGES)
    wait_minutes = DELAY_BETWEEN_POSTS_SEC / 60

    # --- The Core Change: Loop Infinitely ---
    while True:
        cycle += 1
        print(f"\n--- Starting Cycle #{cycle} of reminders ---")

        for i, message in enumerate(REMINDER_MESSAGES):
            print(f"[Cycle {cycle} | Message {i + 1}/{message_count}] Posting reminder...")
            post_message(youtube_service, live_chat_id, message)

            # Wait the defined delay after every single message is posted.
            # This ensures consistent spacing between the last message of one cycle
            # and the first message of the next cycle.
            print(f"💤 Waiting for {wait_minutes:.0f} minutes ({DELAY_BETWEEN_POSTS_SEC} seconds)...")
            time.sleep(DELAY_BETWEEN_POSTS_SEC)

        print(f"--- Cycle #{cycle} complete. Delay elapsed. Restarting sequence now. ---")


if __name__ == '__main__':
    try:
        # 1. Authenticate with YouTube
        youtube = get_authenticated_service()

        # 2. Run the continuous reminder poster function
        post_reminders_from_list(youtube)

    except HttpError as e:
        print(f"\n❌ A major HTTP error occurred: {e}")
        print("Please check your API key, client secret file, and quota usage.")
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")
