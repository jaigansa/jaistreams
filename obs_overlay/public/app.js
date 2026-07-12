// ================= Shared Data =================
let gameInfo = [];
let missions = [];
let selectedGameIndex = 0;
let selectedMissionIndex = 0;
let socialLinks = [];
let socialIndex = 0;

let missionInterval;
let socialInterval;

// ================= Channel Data =================
async function fetchChannelData() {
  try {
    const response = await fetch('/get-channel-data');
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    if (!data) return null;

    return {
      avatarUrl: data.avatarUrl,
      title: data.title,
      subscribers: formatCount(Number(data.subscribers)),
      views: formatCount(Number(data.views)),
      videos: data.videos,
    };
  } catch (error) {
    console.error("Error fetching channel data:", error);
    return null;
  }
}

function formatCount(number) {
  if (number < 1000) return number.toString();
  const suffixes = ["k", "M", "B", "T"];
  let idx = -1;
  let num = number;
  while (num >= 1000 && idx < suffixes.length - 1) {
    idx++;
    num /= 1000;
  }
  return num.toFixed(1) + suffixes[idx];
}

// ================= Update Channel Info =================
async function updateChannelInfo() {
  const data = await fetchChannelData();
  if (!data) return;

  const avatarDiv = document.getElementById("avatar-container");
  if (avatarDiv) avatarDiv.innerHTML = `<img src="${data.avatarUrl}" alt="Avatar" class="w-full h-full object-cover" />`;
  
  const titleDiv = document.getElementById("channel-title");
  if (titleDiv) titleDiv.textContent = data.title;
  
  const subDiv = document.getElementById("subscriber-count");
  if (subDiv) subDiv.textContent = data.subscribers;
  
  const viewsDiv = document.getElementById("view-count");
  if (viewsDiv) viewsDiv.textContent = data.views;
  
  const videosDiv = document.getElementById("video-count");
  if (videosDiv) videosDiv.textContent = data.videos;
}

// ================= Load Data =================
async function loadData() {
  try {
    const response = await fetch("data/db.json?t=" + Date.now());
    const allData = await response.json();

    const newGameInfo = allData.game_info.filter(g => g.status === "Show");
    const newMissions = allData.missions.filter(m => m.progress && m.progress.status === "Show");
    
    // Dynamically read ALL social link keys from db.json
    const newSocialLinks = [];
    if (allData.social_links) {
      for (const [name, url] of Object.entries(allData.social_links)) {
        if (url) newSocialLinks.push({ name, url });
      }
    }

    // Update Game Info if changed
    if (JSON.stringify(newGameInfo) !== JSON.stringify(gameInfo)) {
      gameInfo = newGameInfo;
      selectedGameIndex = 0;
      renderGame();
    }

    // Update Social Links if changed
    if (JSON.stringify(newSocialLinks) !== JSON.stringify(socialLinks)) {
      socialLinks = newSocialLinks;
      socialIndex = 0;
      startSocialLoop();
    }

    // Update Missions if changed/updated
    if (JSON.stringify(newMissions) !== JSON.stringify(missions)) {
      missions = newMissions;
      selectedMissionIndex = 0;
      renderMission();
      startMissionLoop();
    } else {
      renderMission();
    }

  } catch (error) {
    console.error("Error loading data:", error);
  }
}

// ================= Render Game =================
function renderGame() {
  const container = document.getElementById("game-title");
  const buttons = document.getElementById("game-button");

  if (!gameInfo.length) {
    if (container) container.innerHTML = "<p class='text-zinc-500 text-sm'>No games available</p>";
    if (buttons) buttons.innerHTML = "";
    return;
  }

  const game = gameInfo[selectedGameIndex];

  if (container) {
    container.innerHTML = `
      <div class="text-center">
        <h2 class="text-3xl tracking-tight font-bold text-white">${game.title} <span class="text-indigo-400 text-xl font-semibold">${game.version}</span></h2>
      </div>
    `;
  }

  if (buttons) {
    buttons.innerHTML = `
      <div class="inline-flex items-center justify-center w-full space-x-3 mt-4">
        <button onclick="selectItem('game', -1)" class="w-2.5 h-2.5 bg-zinc-600 hover:bg-zinc-400 transition-colors flex items-center justify-center rounded-full"></button>
        <button onclick="selectItem('game', 1)" class="w-2.5 h-2.5 bg-zinc-600 hover:bg-zinc-400 transition-colors flex items-center justify-center rounded-full"></button>
      </div>
    `;
  }
}

// ================= Render Mission =================
function renderMission() {
  const container = document.getElementById("missions");
  const buttons = document.getElementById("mission-buttons");

  if (!missions.length) {
    if (container) container.innerHTML = "<p class='text-zinc-500 text-sm'>No objectives available</p>";
    if (buttons) buttons.innerHTML = "";
    return;
  }

  const mission = missions[selectedMissionIndex];
  const progress = Math.floor((mission.progress.current / (mission.progress.total || 1)) * 100);

  if (container) {
    container.innerHTML = `
      <div class="w-full text-center">
        <h2 class="text-3xl font-bold text-white mb-2">${mission.title}</h2>
        <p class="text-zinc-400 text-sm mb-4 max-w-lg mx-auto">${mission.objective}</p>
        
        <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
          <span>Reward: <strong class="text-emerald-400">${mission.rewards}</strong></span>
          <span>Progress: <strong class="text-indigo-400">${mission.progress.current}/${mission.progress.total}</strong></span>
        </div>
        
        <div class="w-full bg-zinc-950 border border-zinc-800 h-4 rounded-full overflow-hidden">
          <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }

  if (buttons) {
    buttons.innerHTML = `
      <div class="inline-flex items-center justify-center space-x-2">
        <button onclick="selectItem('mission', -1)" class="w-2.5 h-2.5 bg-zinc-600 hover:bg-zinc-400 transition flex items-center justify-center rounded-full"></button>
        <button onclick="selectItem('mission', 1)" class="w-2.5 h-2.5 bg-zinc-600 hover:bg-zinc-400 transition flex items-center justify-center rounded-full"></button>
      </div>
    `;
  }
}

// ================= Auto-loop Missions =================
function startMissionLoop() {
  if (missionInterval) clearInterval(missionInterval);
  if (missions.length <= 1) return;

  missionInterval = setInterval(() => {
    selectedMissionIndex = (selectedMissionIndex + 1) % missions.length;
    renderMission();
  }, 10000);
}

// ================= Auto-loop Socials =================
function startSocialLoop() {
  if (socialInterval) clearInterval(socialInterval);
  
  if (socialLinks.length === 0) {
    const qrContainer = document.getElementById("qrcode-container");
    const label = document.getElementById("social-label");
    if (qrContainer) qrContainer.style.display = "none";
    if (label) label.textContent = "No Links";
    return;
  }
  
  const qrContainer = document.getElementById("qrcode-container");
  if (qrContainer) qrContainer.style.display = "flex";

  renderSocial();

  if (socialLinks.length <= 1) return;

  socialInterval = setInterval(() => {
    socialIndex = (socialIndex + 1) % socialLinks.length;
    renderSocial();
  }, 10000);
}

// ================= Render QR =================
function renderSocial() {
  const social = socialLinks[socialIndex];
  if (!social) return;

  const qrImage = document.getElementById("qrcode");
  const labelDiv = document.getElementById("social-label");
  const buttonsDiv = document.getElementById("qr-buttons");

  if (qrImage) {
    qrImage.classList.remove("fade-in");
    qrImage.classList.add("fade-out");
  }

  setTimeout(() => {
    if (qrImage) {
      qrImage.src = `/qr?text=${encodeURIComponent(social.url)}`;
      qrImage.classList.remove("fade-out");
      qrImage.classList.add("fade-in");
      qrImage.classList.remove("hidden");
    }

    if (labelDiv) {
      labelDiv.textContent = social.name;
      labelDiv.className = "text-xl font-bold tracking-tight transition-colors duration-300";
      if (social.name.toLowerCase() === "youtube") labelDiv.classList.add("text-rose-500");
      else if (social.name.toLowerCase() === "instagram") labelDiv.classList.add("text-pink-500");
      else labelDiv.classList.add("text-indigo-400");
    }

    if (buttonsDiv && socialLinks.length > 1) {
      buttonsDiv.innerHTML = `
        <button onclick="selectItem('social', -1)" class="w-2 h-2 bg-zinc-600 hover:bg-zinc-400 rounded-full transition"></button>
        <button onclick="selectItem('social', 1)" class="w-2 h-2 bg-zinc-600 hover:bg-zinc-400 rounded-full transition"></button>
      `;
    } else if (buttonsDiv) {
      buttonsDiv.innerHTML = "";
    }
  }, 400);
}

// ================= Manual Selection =================
window.selectItem = function (type, direction) {
  if (type === "game") {
    if (gameInfo.length === 0) return;
    selectedGameIndex = (selectedGameIndex + direction + gameInfo.length) % gameInfo.length;
    renderGame();
  } else if (type === "mission") {
    if (missions.length === 0) return;
    selectedMissionIndex = (selectedMissionIndex + direction + missions.length) % missions.length;
    renderMission();
    startMissionLoop();
  } else if (type === "social") {
    if (socialLinks.length === 0) return;
    socialIndex = (socialIndex + direction + socialLinks.length) % socialLinks.length;
    renderSocial();
    startSocialLoop();
  }
};

// ================= Initialize =================
document.addEventListener("DOMContentLoaded", () => {
  updateChannelInfo();
  loadData();

  // Refresh YouTube stats every 5 minutes
  setInterval(updateChannelInfo, 300000);

  // Poll database updates every 2 seconds
  setInterval(loadData, 2000);
});
