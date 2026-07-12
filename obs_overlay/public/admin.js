// Stream Control Panel JS
let allData = {};
let missions = [];
let games = []; // Array of { title, version, status }
let socialLinks = []; // Array of { name, url }

const missionsListContainer = document.getElementById("missions-list");
const toast = document.getElementById("toast");

// Show Toast Notification
function showToast(message, type = "success") {
  toast.innerHTML = `<span class="${type === 'success' ? 'text-emerald-500' : 'text-rose-500'} font-bold">${type === 'success' ? '✓' : '✗'}</span> <span class="text-zinc-200">${message}</span>`;
  toast.className = `fixed bottom-6 right-6 px-5 py-3 rounded-lg text-white font-medium text-sm transform transition duration-200 shadow-xl z-50 flex items-center space-x-2.5 bg-zinc-900 border ${
    type === "success" ? "border-emerald-950" : "border-rose-950"
  }`;
  toast.style.transform = "translateY(0)";
  toast.style.opacity = "1";
  
  setTimeout(() => {
    toast.style.transform = "translateY(20px)";
    toast.style.opacity = "0";
  }, 3000);
}

// Load current configuration and data
async function init() {
  try {
    // 1. Fetch DB data (game_info, missions, social_links)
    const dbResponse = await fetch("data/db.json");
    allData = await dbResponse.json();
    missions = allData.missions || [];

    // Fill Game Info
    games = allData.game_info || [];
    renderGamesEditor();

    // Fill Social Links (convert object to array)
    if (allData.social_links) {
      socialLinks = [];
      for (const [name, url] of Object.entries(allData.social_links)) {
        if (url) socialLinks.push({ name, url });
      }
      renderSocialEditor();
    }

    // Render Missions Editor
    renderMissionsEditor();

    // 2. Fetch Server Config (.env)
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();
    document.getElementById("config-port").value = config.PORT || "3000";
    document.getElementById("config-channel-id").value = config.CHANNEL_ID || "";
    document.getElementById("config-api-key").value = config.YOUTUBE_API_KEY || "";

  } catch (error) {
    console.error("Error loading panel data:", error);
    showToast("Error loading panel data", "error");
  }
}

// Render Missions Form Editor
function renderMissionsEditor() {
  missionsListContainer.innerHTML = "";

  if (missions.length === 0) {
    missionsListContainer.innerHTML = `<p class="text-zinc-500 text-sm text-center py-8">No objectives available. Click Add Objective to create one.</p>`;
    return;
  }

  missions.forEach((mission, index) => {
    const card = document.createElement("div");
    card.className = "bg-zinc-950/40 p-5 rounded-xl border border-zinc-800/80 hover:border-zinc-700 transition duration-150 space-y-4 relative";
    
    const isShowing = mission.progress && mission.progress.status === "Show";
    const current = mission.progress ? mission.progress.current : 0;
    const total = mission.progress ? mission.progress.total : 100;
    const percent = Math.min(100, Math.floor((current / (total || 1)) * 100));

    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-zinc-900 pb-3">
        <h3 class="text-sm font-semibold text-zinc-200">Objective #${index + 1}</h3>
        <div class="flex items-center space-x-4">
          <label class="inline-flex items-center cursor-pointer select-none">
            <span class="mr-2.5 text-xs text-zinc-400">Show on stream</span>
            <input type="checkbox" class="form-checkbox bg-zinc-900 border-zinc-800 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
                   ${isShowing ? "checked" : ""} onchange="updateMissionVisibility(${index}, this.checked)">
          </label>
          <button onclick="deleteMission(${index})" class="text-xs font-semibold text-rose-500 hover:text-rose-400 transition">
            Delete
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-zinc-400 mb-1.5">Objective Title</label>
          <input type="text" class="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" 
                 value="${mission.title || ""}" oninput="updateMissionValue(${index}, 'title', this.value)">
        </div>
        <div>
          <label class="block text-xs font-medium text-zinc-400 mb-1.5">Rewards / Payout</label>
          <input type="text" class="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" 
                 value="${mission.rewards || ""}" oninput="updateMissionValue(${index}, 'rewards', this.value)">
        </div>
        <div class="sm:col-span-2">
          <label class="block text-xs font-medium text-zinc-400 mb-1.5">Details / Description</label>
          <input type="text" class="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" 
                 value="${mission.objective || ""}" oninput="updateMissionValue(${index}, 'objective', this.value)">
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between border-t border-zinc-900 pt-4 gap-4">
        <div class="flex items-center space-x-3">
          <span class="text-xs font-medium text-zinc-400">Progress Tracker:</span>
          <div class="flex items-center bg-zinc-950 border border-zinc-850 rounded-lg p-1">
            <button onclick="adjustProgress(${index}, -1)" class="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white font-bold transition rounded-full hover:bg-zinc-900">-</button>
            <span class="px-3 text-zinc-200 font-semibold text-sm select-none" id="progress-val-${index}">${current}</span>
            <button onclick="adjustProgress(${index}, 1)" class="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white font-bold transition rounded-full hover:bg-zinc-900">+</button>
          </div>
          <span class="text-zinc-600 text-sm">/</span>
          <input type="number" class="w-16 bg-zinc-950 border border-zinc-850 rounded-lg p-2 text-zinc-100 text-center text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                 value="${total}" oninput="updateMissionProgressTotal(${index}, this.value)">
        </div>
        
        <!-- Live Preview Bar -->
        <div class="flex-grow max-w-xs space-y-1.5">
          <div class="flex justify-between text-[10px] font-medium text-zinc-400">
            <span>Overlay Preview</span>
            <span id="preview-text-${index}" class="text-zinc-300 font-semibold">${percent}%</span>
          </div>
          <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850">
            <div id="preview-bar-${index}" class="bg-indigo-500 h-full rounded-full transition-all duration-300" style="width: ${percent}%"></div>
          </div>
        </div>
      </div>
    `;

    missionsListContainer.appendChild(card);
  });
}

// Adjust progress values dynamically
window.adjustProgress = function(index, delta) {
  if (!missions[index].progress) {
    missions[index].progress = { current: 0, total: 10, status: "Show" };
  }

  const progress = missions[index].progress;
  progress.current = Math.max(0, progress.current + delta);
  document.getElementById(`progress-val-${index}`).textContent = progress.current;
  
  // Update Live Preview Bar
  updateLivePreviewBar(index);
};

window.updateMissionProgressTotal = function(index, val) {
  if (!missions[index].progress) {
    missions[index].progress = { current: 0, total: 10, status: "Show" };
  }
  missions[index].progress.total = parseInt(val, 10) || 0;
  
  // Update Live Preview Bar
  updateLivePreviewBar(index);
};

// Calculate and update the live preview bar & text
function updateLivePreviewBar(index) {
  const mission = missions[index];
  if (!mission || !mission.progress) return;
  
  const current = mission.progress.current || 0;
  const total = mission.progress.total || 1;
  const percent = Math.min(100, Math.floor((current / (total || 1)) * 100));

  const textElement = document.getElementById(`preview-text-${index}`);
  const barElement = document.getElementById(`preview-bar-${index}`);

  if (textElement) textElement.textContent = `${percent}%`;
  if (barElement) barElement.style.width = `${percent}%`;
}

window.updateMissionValue = function(index, key, val) {
  missions[index][key] = val;
};

window.updateMissionVisibility = function(index, isChecked) {
  if (!missions[index].progress) {
    missions[index].progress = { current: 0, total: 10, status: "Show" };
  }
  missions[index].progress.status = isChecked ? "Show" : "Hide";
};

// Delete mission
window.deleteMission = function(index) {
  missions.splice(index, 1);
  renderMissionsEditor();
};

// Add Mission
document.getElementById("add-mission-btn").addEventListener("click", () => {
  missions.push({
    title: "New Mission",
    objective: "Perform task on stream",
    rewards: "100 Points",
    progress: {
      current: 0,
      total: 10,
      status: "Show"
    }
  });
  renderMissionsEditor();
});

// ================= Games Dynamic Editor =================
const gamesListContainer = document.getElementById("games-list");

function renderGamesEditor() {
  if (!gamesListContainer) return;
  gamesListContainer.innerHTML = "";

  if (games.length === 0) {
    gamesListContainer.innerHTML = `<p class="text-zinc-500 text-xs text-center py-4">No games added yet.</p>`;
    return;
  }

  games.forEach((game, index) => {
    const isActive = game.status === "Show";
    const row = document.createElement("div");
    row.className = `p-3 rounded-lg border transition duration-150 space-y-2 ${isActive ? "bg-indigo-950/30 border-indigo-800/60" : "bg-zinc-950/40 border-zinc-800/80"}`;
    row.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 flex-grow min-w-0">
          <button onclick="setActiveGame(${index})" class="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition ${isActive ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600 hover:border-zinc-400'}" title="${isActive ? 'Active' : 'Set as active'}">
            ${isActive ? '<span class="w-1.5 h-1.5 bg-white rounded-full"></span>' : ''}
          </button>
          <span class="text-xs font-medium ${isActive ? 'text-indigo-300' : 'text-zinc-400'}">${isActive ? 'ACTIVE' : 'Inactive'}</span>
        </div>
        <button onclick="deleteGame(${index})" class="text-rose-500 hover:text-rose-400 transition flex-shrink-0" title="Remove">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
      <div class="flex items-end gap-2">
        <div class="flex-grow min-w-0">
          <label class="block text-[10px] font-medium text-zinc-400 mb-1">Title</label>
          <input type="text" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                 value="${game.title || ''}" oninput="updateGame(${index}, 'title', this.value)">
        </div>
        <div class="w-20 flex-shrink-0">
          <label class="block text-[10px] font-medium text-zinc-400 mb-1">Version</label>
          <input type="text" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                 value="${game.version || ''}" oninput="updateGame(${index}, 'version', this.value)">
        </div>
      </div>
    `;
    gamesListContainer.appendChild(row);
  });
}

window.updateGame = function(index, key, val) {
  games[index][key] = val;
};

window.setActiveGame = function(index) {
  // Set all to Hide, then set the selected one to Show
  games.forEach(g => g.status = "Hide");
  games[index].status = "Show";
  renderGamesEditor();
};

window.deleteGame = function(index) {
  games.splice(index, 1);
  renderGamesEditor();
};

document.getElementById("add-game-btn").addEventListener("click", () => {
  games.push({ title: "", version: "", status: "Hide" });
  renderGamesEditor();
});

// ================= Social Links Dynamic Editor =================
const socialListContainer = document.getElementById("social-links-list");

function renderSocialEditor() {
  socialListContainer.innerHTML = "";

  if (socialLinks.length === 0) {
    socialListContainer.innerHTML = `<p class="text-zinc-500 text-xs text-center py-4">No social links added yet.</p>`;
    return;
  }

  socialLinks.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "flex items-end gap-2";
    row.innerHTML = `
      <div class="w-24 flex-shrink-0">
        <label class="block text-[10px] font-medium text-zinc-400 mb-1">Name</label>
        <input type="text" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
               value="${link.name}" oninput="updateSocialLink(${index}, 'name', this.value)">
      </div>
      <div class="flex-grow min-w-0">
        <label class="block text-[10px] font-medium text-zinc-400 mb-1">URL</label>
        <input type="url" class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
               value="${link.url}" oninput="updateSocialLink(${index}, 'url', this.value)">
      </div>
      <button onclick="deleteSocialLink(${index})" class="px-2 py-2 text-rose-500 hover:text-rose-400 transition flex-shrink-0" title="Remove">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    `;
    socialListContainer.appendChild(row);
  });
}

window.updateSocialLink = function(index, key, val) {
  socialLinks[index][key] = val;
};

window.deleteSocialLink = function(index) {
  socialLinks.splice(index, 1);
  renderSocialEditor();
};

document.getElementById("add-social-btn").addEventListener("click", () => {
  socialLinks.push({ name: "", url: "" });
  renderSocialEditor();
});

// Save Server & Credentials config (.env)
document.getElementById("save-config-btn").addEventListener("click", async () => {
  const config = {
    PORT: document.getElementById("config-port").value,
    CHANNEL_ID: document.getElementById("config-channel-id").value,
    YOUTUBE_API_KEY: document.getElementById("config-api-key").value
  };

  try {
    const response = await fetch("/api/config/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(config)
    });

    if (response.ok) {
      showToast("Credentials saved and loaded!");
    } else {
      throw new Error("Failed to save credentials");
    }
  } catch (error) {
    console.error("Save credentials error:", error);
    showToast("Error saving credentials", "error");
  }
});

// Save all live stream changes (Game Info, Social Links, Missions)
document.getElementById("save-all-btn").addEventListener("click", async () => {
  // Update Game Info — use the games array directly
  const gameInfo = games;

  // Update Social Links (convert array back to object for db.json)
  const socialLinksObj = {};
  socialLinks.forEach(link => {
    if (link.name && link.url) {
      socialLinksObj[link.name.toLowerCase()] = link.url;
    }
  });

  // Compile final DB layout
  const updatedData = {
    game_info: gameInfo,
    social_links: socialLinksObj,
    missions: missions
  };

  try {
    const response = await fetch("/api/db/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedData)
    });

    if (response.ok) {
      showToast("Live changes successfully saved & synced!");
    } else {
      throw new Error("Failed to save live changes");
    }
  } catch (error) {
    console.error("Save all error:", error);
    showToast("Error saving live changes", "error");
  }
});

// ================= OBS Widgets with Scale Controller =================
const obsWidgets = [
  { id: "all",      label: "Combined HUD",     desc: "All modules active",     path: "/overlay.html",                scale: 1 },
  { id: "yt",       label: "YouTube Counter",   desc: "Live statistics HUD",    path: "/overlay.html?module=yt",      scale: 1 },
  { id: "qr",       label: "Social QR Loop",    desc: "QR code loops",          path: "/overlay.html?module=qr",      scale: 1 },
  { id: "missions", label: "Missions Tracker",  desc: "Missions and progress",  path: "/overlay.html?module=missions", scale: 1 },
];

function renderOBSWidgets() {
  const container = document.getElementById("obs-widgets-list");
  if (!container) return;
  container.innerHTML = "";

  obsWidgets.forEach((widget, index) => {
    const row = document.createElement("div");
    row.className = "bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/80 hover:border-zinc-700 transition duration-150 space-y-2";
    row.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="min-w-0 pr-2">
          <span class="block font-medium text-zinc-200 text-xs">${widget.label}</span>
          <span class="block text-[10px] text-zinc-500">${widget.desc}</span>
        </div>
        <button onclick="copyScaledWidgetUrl(${index})" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-[10px] font-semibold tracking-wide transition duration-150 flex-shrink-0">
          Copy
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-zinc-500 flex-shrink-0 w-8">Size</span>
        <input type="range" min="0.5" max="3" step="0.1" value="${widget.scale}"
               class="flex-grow h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
               oninput="updateWidgetScale(${index}, this.value)">
        <span id="obs-scale-val-${index}" class="text-[10px] font-bold text-indigo-400 w-8 text-right">${widget.scale}x</span>
      </div>
    `;
    container.appendChild(row);
  });
}

window.updateWidgetScale = function(index, val) {
  obsWidgets[index].scale = parseFloat(val);
  const label = document.getElementById(`obs-scale-val-${index}`);
  if (label) label.textContent = `${parseFloat(val).toFixed(1)}x`;
};

window.copyScaledWidgetUrl = function(index) {
  const widget = obsWidgets[index];
  const separator = widget.path.includes("?") ? "&" : "?";
  const scaleStr = widget.scale !== 1 ? `${separator}scale=${widget.scale}` : "";
  const fullUrl = window.location.origin + widget.path + scaleStr;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast("Widget URL copied to clipboard!");
  }).catch(err => {
    console.error("Failed to copy URL:", err);
    showToast("Failed to copy URL. Please copy it manually.", "error");
  });
};

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  init();
  renderOBSWidgets();
});
