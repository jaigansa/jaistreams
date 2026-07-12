package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/skip2/go-qrcode"
)

// getChannelData fetches details about a YouTube channel using YouTube Data API v3
func getChannelData(w http.ResponseWriter, r *http.Request) {
	channelID := os.Getenv("CHANNEL_ID")
	apiKey := os.Getenv("YOUTUBE_API_KEY")

	if channelID == "" || apiKey == "" {
		// No API key provided: return placeholder data so the app can function without it
		channelData := map[string]interface{}{
			"avatarUrl":   "https://ui-avatars.com/api/?name=Local+Stream&background=4f46e5&color=fff&size=128",
			"title":       "Local Stream",
			"subscribers": "0",
			"views":       "0",
			"videos":      "0",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(channelData)
		return
	}

	url := fmt.Sprintf("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=%s&key=%s", channelID, apiKey)

	resp, err := http.Get(url)
	if err != nil {
		log.Printf("Error fetching channel data from YouTube: %v\n", err)
		http.Error(w, "Error fetching channel data", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("YouTube API returned non-OK status: %s\n", resp.Status)
		http.Error(w, "Error fetching channel data from YouTube", resp.StatusCode)
		return
	}

	var ytResp struct {
		Items []struct {
			Snippet struct {
				Title      string `json:"title"`
				Thumbnails struct {
					Default struct {
						URL string `json:"url"`
					} `json:"default"`
				} `json:"thumbnails"`
			} `json:"snippet"`
			Statistics struct {
				SubscriberCount string `json:"subscriberCount"`
				ViewCount       string `json:"viewCount"`
				VideoCount      string `json:"videoCount"`
			} `json:"statistics"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&ytResp); err != nil {
		log.Printf("Error decoding YouTube API response: %v\n", err)
		http.Error(w, "Error parsing channel data", http.StatusInternalServerError)
		return
	}

	if len(ytResp.Items) == 0 {
		http.Error(w, "Channel not found", http.StatusNotFound)
		return
	}

	item := ytResp.Items[0]
	channelData := map[string]interface{}{
		"avatarUrl":   item.Snippet.Thumbnails.Default.URL,
		"title":       item.Snippet.Title,
		"subscribers": item.Statistics.SubscriberCount,
		"views":       item.Statistics.ViewCount,
		"videos":      item.Statistics.VideoCount,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(channelData); err != nil {
		log.Printf("Error encoding channel data response: %v\n", err)
	}
}

// generateQR generates a QR Code PNG from the "text" query parameter
func generateQR(w http.ResponseWriter, r *http.Request) {
	text := r.URL.Query().Get("text")
	if text == "" {
		text = "https://example.com"
	}

	// Generate QR Code PNG (512px for crisp scanability)
	png, err := qrcode.Encode(text, qrcode.Medium, 512)
	if err != nil {
		log.Printf("QR generation error: %v\n", err)
		http.Error(w, "QR code generation failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(png)))
	if _, err := w.Write(png); err != nil {
		log.Printf("Error writing QR code response: %v\n", err)
	}
}

// getConfig reads the active environment configuration variables (.env)
func getConfig(w http.ResponseWriter, r *http.Request) {
	configData := map[string]string{
		"PORT":            os.Getenv("PORT"),
		"YOUTUBE_API_KEY": os.Getenv("YOUTUBE_API_KEY"),
		"CHANNEL_ID":      os.Getenv("CHANNEL_ID"),
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(configData); err != nil {
		log.Printf("Error encoding config data: %v\n", err)
	}
}

// saveConfig writes updated configuration values to .env and updates the current process env
func saveConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload map[string]string
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	apiKey := payload["YOUTUBE_API_KEY"]
	channelID := payload["CHANNEL_ID"]
	port := payload["PORT"]

	if port == "" {
		port = "3000"
	}

	// Save to .env
	envContent := fmt.Sprintf("# Server Configuration\nPORT=%s\n\n# YouTube Data API Configuration\nYOUTUBE_API_KEY=%s\nCHANNEL_ID=%s\n", port, apiKey, channelID)
	err := os.WriteFile(".env", []byte(envContent), 0644)
	if err != nil {
		log.Printf("Error writing .env file: %v\n", err)
		http.Error(w, "Failed to write config file", http.StatusInternalServerError)
		return
	}

	// Hot reload in-memory configuration variables
	os.Setenv("PORT", port)
	os.Setenv("YOUTUBE_API_KEY", apiKey)
	os.Setenv("CHANNEL_ID", channelID)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Config saved and reloaded successfully"))
}

// saveDB saves the JSON config payload directly to public/data/db.json
func saveDB(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var rawBody json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		log.Printf("Error decoding saveDB request: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := os.WriteFile("public/data/db.json", rawBody, 0644)
	if err != nil {
		log.Printf("Error writing public/data/db.json: %v\n", err)
		http.Error(w, "Failed to save database file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Database saved successfully"))
}

func main() {
	// Load .env file (if present)
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found or unable to load. Using existing environment variables.")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// Serve static files from the 'public' directory
	fs := http.FileServer(http.Dir("./public"))

	// Web API Handlers
	http.HandleFunc("/get-channel-data", getChannelData)
	http.HandleFunc("/qr", generateQR)
	http.HandleFunc("/api/config", getConfig)
	http.HandleFunc("/api/config/save", saveConfig)
	http.HandleFunc("/api/db/save", saveDB)
	http.Handle("/", fs)

	log.Printf("✅ Server is running at http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed to start: %v\n", err)
	}
}
