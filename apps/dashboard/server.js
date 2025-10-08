require('dotenv').config();
const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Serve static files (public folder: index.html, main.js, style.css, db.json, etc.)
app.use(express.static('public'));

// ================= YouTube Channel Data =================
app.get('/get-channel-data', async (req, res) => {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'snippet,statistics',
        id: CHANNEL_ID,
        key: YOUTUBE_API_KEY
      }
    });

    const channel = response.data.items[0];
    console.log (channel);
    if (!channel) return res.status(404).send('Channel not found');

    const channelData = {
      avatarUrl: channel.snippet.thumbnails.default.url,
      title: channel.snippet.title,
      subscribers: channel.statistics.subscriberCount,
      views: channel.statistics.viewCount,
      videos: channel.statistics.videoCount
    };

    res.json(channelData);
  } catch (error) {
    console.error('Error fetching channel data:', error.response?.data || error.message);
    res.status(500).send('Error fetching channel data');
  }
});

// ================= QR Code Generator =================
app.get('/qr', async (req, res) => {
  const text = req.query.text || 'https://example.com';

  try {
    const qrDataUrl = await QRCode.toDataURL(text, { margin: 1, width: 200 });
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const img = Buffer.from(base64Data, "base64");

    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": img.length
    });
    res.end(img);
  } catch (err) {
    console.error("QR generation error:", err);
    res.status(500).json({ error: "QR code generation failed" });
  }
});

// ================= Start Server =================
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
