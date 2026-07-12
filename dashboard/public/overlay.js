// OBS Stream Overlay Logic
let gameInfo = [];
let missions = [];
let socialLinks = [];

let selectedMissionIndex = 0;
let socialIndex = 0;

let missionInterval;
let socialInterval;
let syncInterval;
let ytInterval;

// Format large numbers
function formatCount(number) {
  const num = Number(number);
  if (isNaN(num)) return number ? number.toString() : "--";
  if (num < 1000) return num.toString();
  const suffixes = ["k", "M", "B", "T"];
  let idx = -1;
  let tempVal = num;
  while (tempVal >= 1000 && idx < suffixes.length - 1) {
    idx++;
    tempVal /= 1000;
  }
  return tempVal.toFixed(1) + suffixes[idx];
}

// Fetch URL Query Parameters for routing
const urlParams = new URLSearchParams(window.location.search);
const moduleParam = (urlParams.get("module") || "all").toLowerCase();
const scaleParam = parseFloat(urlParams.get("scale")) || 1;

// Apply visibility and layout configurations on page load
function configureModuleRouting() {
  const statsCard = document.getElementById("stats-card");
  const socialsCard = document.getElementById("socials-card");
  const missionCard = document.getElementById("mission-card");
  const hudContainer = document.getElementById("hud-container");

  // Remove default positioning classes
  hudContainer.className = "";

  if (moduleParam === "yt") {
    statsCard.style.display = "flex";
    socialsCard.style.display = "none";
    missionCard.style.display = "none";
    hudContainer.className = "w-full max-w-[320px] p-1";
  } else if (moduleParam === "qr") {
    statsCard.style.display = "none";
    socialsCard.style.display = "flex";
    missionCard.style.display = "none";
    hudContainer.className = "w-full max-w-[320px] p-1";
  } else if (moduleParam === "missions") {
    statsCard.style.display = "none";
    socialsCard.style.display = "none";
    missionCard.style.display = "block";
    hudContainer.className = "w-full max-w-[320px] p-1";
  } else {
    // Default to displaying all modules in a stacked layout at bottom-right
    statsCard.style.display = "flex";
    socialsCard.style.display = "flex";
    missionCard.style.display = "block";
    hudContainer.className = "fixed bottom-6 right-6 w-80 space-y-4";
  }

  // Apply scale from URL parameter (?scale=1.5)
  if (scaleParam !== 1) {
    hudContainer.style.transform = `scale(${scaleParam})`;
    hudContainer.style.transformOrigin = "top left";
  }
}

// Fetch YouTube Channel stats
async function fetchChannelStats() {
  if (moduleParam !== "all" && moduleParam !== "yt") return; // Skip if YT module not active

  try {
    const response = await fetch("/get-channel-data");
    if (!response.ok) return;
    const data = await response.json();
    if (!data) return;

    document.getElementById("avatar-image").innerHTML = `<img src="${data.avatarUrl}" alt="Avatar" class="w-full h-full object-cover" />`;
    document.getElementById("channel-title").textContent = data.title;
    document.getElementById("subscribers-count").textContent = formatCount(data.subscribers);
    document.getElementById("total-channel-views").textContent = formatCount(data.views);
  } catch (error) {
    console.error("Error fetching YouTube stats:", error);
  }
}

// Read database updates (sync live changes from Admin panel)
async function syncDatabase() {
  try {
    const response = await fetch("data/db.json?t=" + Date.now()); // Prevent caching
    const allData = await response.json();

    // 1. Sync Game Info (Missions card needs this)
    if (moduleParam === "all" || moduleParam === "missions") {
      if (allData.game_info && allData.game_info[0]) {
        const game = allData.game_info[0];
        document.getElementById("game-info").textContent = `${game.title} ${game.version}`;
      }
    }

    // 2. Sync Social Links (QR card needs this)
    if (moduleParam === "all" || moduleParam === "qr") {
      const updatedSocialLinks = [
        { name: "YouTube", url: allData.social_links.youtube },
        { name: "Website", url: allData.social_links.website },
        { name: "Instagram", url: allData.social_links.instagram },
      ].filter(s => s.url); // Only include filled links

      if (JSON.stringify(updatedSocialLinks) !== JSON.stringify(socialLinks)) {
        socialLinks = updatedSocialLinks;
        socialIndex = 0;
        startSocialLoop();
      }
    }

    // 3. Sync Missions (Missions card needs this)
    if (moduleParam === "all" || moduleParam === "missions") {
      const updatedMissions = (allData.missions || []).filter(m => m.progress && m.progress.status === "Show");
      
      if (JSON.stringify(updatedMissions) !== JSON.stringify(missions)) {
        missions = updatedMissions;
        selectedMissionIndex = 0;
        renderMission();
        startMissionLoop();
      } else {
        // Just refresh progress values in real time
        renderMissionProgress();
      }
    }

  } catch (error) {
    console.error("Error syncing DB:", error);
  }
}

// Render current mission content with transition
function renderMission() {
  const container = document.getElementById("mission-container");
  if (!container) return;
  
  if (missions.length === 0) {
    document.getElementById("mission-title").textContent = "No active mission";
    document.getElementById("mission-objective").textContent = "Missions list is empty";
    document.getElementById("mission-progress-text").textContent = "0/0";
    document.getElementById("mission-progress-bar").style.width = "0%";
    return;
  }

  const mission = missions[selectedMissionIndex];
  
  // Fade out
  container.classList.remove("fade-in");
  container.classList.add("fade-out");

  setTimeout(() => {
    document.getElementById("mission-title").textContent = mission.title;
    document.getElementById("mission-objective").textContent = mission.objective;
    
    renderMissionProgress();

    // Fade in
    container.classList.remove("fade-out");
    container.classList.add("fade-in");
  }, 500);
}

// Fast update progress without fading title
function renderMissionProgress() {
  if (missions.length === 0) return;
  const mission = missions[selectedMissionIndex];
  if (!mission || !mission.progress) return;

  const current = mission.progress.current || 0;
  const total = mission.progress.total || 100;
  const progressPercent = Math.min(100, Math.floor((current / total) * 100));

  document.getElementById("mission-progress-text").textContent = `${current}/${total}`;
  document.getElementById("mission-progress-bar").style.width = `${progressPercent}%`;
}

// Loop through missions
function startMissionLoop() {
  if (missionInterval) clearInterval(missionInterval);
  if (missions.length <= 1) return;

  missionInterval = setInterval(() => {
    selectedMissionIndex = (selectedMissionIndex + 1) % missions.length;
    renderMission();
  }, 6000);
}

// Render QR code & apply dynamic platform styling
function renderQRCode(url, label) {
  const qrImage = document.getElementById("qrcode");
  const labelDiv = document.getElementById("qr-label");
  const qrContainer = document.getElementById("qrcode-container");

  // Fade out
  qrImage.classList.remove("fade-in");
  qrImage.classList.add("fade-out");
  labelDiv.style.opacity = "0";

  setTimeout(() => {
    qrImage.src = `/qr?text=${encodeURIComponent(url)}`;
    labelDiv.textContent = label;

    // Reset container border
    qrContainer.className = "w-64 h-64 bg-white border border-zinc-300 rounded-xl overflow-hidden p-2 flex items-center justify-center flex-shrink-0 transition-all duration-500";

    // Reset label classes
    labelDiv.className = "text-lg font-bold tracking-tight leading-none transition-colors duration-500";

    // Simple, clean text color highlight based on platform brand
    if (label.toLowerCase() === "youtube") {
      labelDiv.classList.add("text-rose-500");
    } else if (label.toLowerCase() === "instagram") {
      labelDiv.classList.add("text-pink-500");
    } else {
      // Default / Website
      labelDiv.classList.add("text-indigo-400");
    }

    // Fade in
    qrImage.classList.remove("fade-out");
    qrImage.classList.add("fade-in");
    labelDiv.style.opacity = "1";
  }, 500);
}

// Loop through socials
function startSocialLoop() {
  if (socialInterval) clearInterval(socialInterval);
  if (socialLinks.length === 0) {
    document.getElementById("qrcode-container").style.display = "none";
    return;
  }
  document.getElementById("qrcode-container").style.display = "flex";

  renderSocial();

  if (socialLinks.length <= 1) return;

  socialInterval = setInterval(() => {
    socialIndex = (socialIndex + 1) % socialLinks.length;
    renderSocial();
  }, 10000);
}

function renderSocial() {
  if (socialLinks[socialIndex]) {
    renderQRCode(socialLinks[socialIndex].url, socialLinks[socialIndex].name);
  }
}

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  configureModuleRouting();
  fetchChannelStats();
  syncDatabase();

  // 1. Check for live changes from Admin panel every 2 seconds
  syncInterval = setInterval(syncDatabase, 2000);

  // 2. Fetch YouTube stats every 5 minutes
  ytInterval = setInterval(fetchChannelStats, 300000);
});
