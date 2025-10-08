import requests
import json
import time

# --- CONFIGURATION ---
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma:2b-instruct"

# --- JAI'S SYSTEM PROMPT ---
SYSTEM_PROMPT = (
    "You are 'Jai', a chill and entertaining live chat bot for JaiGanesh's YouTube stream. "
    "You reply like a friendly co-host or gamer buddy. Keep it short, fun, and natural, ending with a period. "
    "Never use markdown, emojis, or bullet points. Keep tone casual, real, and hype when chat gets exciting."

    "\n\n### RESPONSE RULES ###\n"
    "1. Always check the KNOWLEDGE BASE first for factual questions.\n"
    "2. If found, reply using only the core fact from it.\n"
    "3. For normal chat, use gamer-style reactions or supportive comments (like 'nice one', 'let's go', 'clean shot').\n"
    "4. Never repeat the same answer more than 3 times per session.\n"
    "5. Avoid robotic or formal wording — sound like a real streamer friend.\n"
    "6. Stay positive, avoid negativity or arguments.\n"

    "\n--- KNOWLEDGE BASE ---\n"
    "Device: OnePlus Tab2.\n"
    "Game ID: jaistreams.\n"
    "Website: https://jaigansa.github.io.\n"
    "Social: @Jaigansa.\n"
    "FAQ Schedule: Random, follow social media.\n"
    "-------------------------"
)

def get_gemma_response(user_message: str) -> str:
    """
    Sends a message to Ollama and returns Jai's live chat reply.
    Ensures it's short, clean, and under 20 words.
    """

    # Build a structured prompt for Gemma
    prompt = f"System:\n{SYSTEM_PROMPT}\n\nUser:\n{user_message}\n\nJai:"

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.5,        # Slightly warmer for live chat fun
            "num_predict": 70,         # Allow a few extra words
        }
    }

    for attempt in range(3):  # Retry logic for reliability
        try:
            response = requests.post(OLLAMA_URL, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()

            raw_response = data.get("response", "").strip()

            # Take only the first line and clean it
            reply = raw_response.split("\n")[0].strip()

            # Enforce ending punctuation
            if reply and reply[-1] not in ('.', '!', '?'):
                reply += '.'

            # Cut off extra length (> 20 words)
            words = reply.split()
            if len(words) > 20:
                reply = " ".join(words[:20]) + "."

            return reply

        except requests.exceptions.RequestException as e:
            print(f"⚠️ Attempt {attempt+1}: Ollama error — {e}")
            time.sleep(1)

    return "Server's acting weird, bro. Try again soon."


# --- LOCAL TEST ---
if __name__ == '__main__':
    print("--- Ollama / Gemma Live Chat Test ---")

    q1 = "who are you?"
    print("User:", q1)
    print("Jai:", get_gemma_response(q1))

    q2 = "Hey Jai, that was a nice clutch!"
    print("\nUser:", q2)
    print("Jai:", get_gemma_response(q2))
