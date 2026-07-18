// Shared client-side logic for theme, modes, YouTube Music player, AdSense, and Zen Mode.

// 1. Theme Logic
const themeBtn = document.getElementById('ctrl-theme');
const sunIcon = document.querySelector('.theme-sun');
const moonIcon = document.querySelector('.theme-moon');

function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  }
}

themeBtn?.addEventListener('click', () => {
  const isDark = !document.documentElement.classList.contains('dark');
  applyTheme(isDark);
  localStorage.setItem('aesthetic-theme', isDark ? 'dark' : 'light');
});

// Initial theme check
applyTheme(document.documentElement.classList.contains('dark'));

// 2. Mode Switcher (Clock <-> Pomodoro) with HTML5 History Routing
const isPomoPath = window.location.pathname.endsWith('/pomodoro') || window.location.pathname.endsWith('/pomodoro/');
let isClockMode = !isPomoPath;

const modeBtn = document.getElementById('ctrl-mode');
const iconClock = document.querySelector('.icon-clock');
const iconTimer = document.querySelector('.icon-timer');
const viewClock = document.getElementById('view-clock');
const viewPomo = document.getElementById('view-pomo');

const seoClock = document.getElementById('seo-content-clock');
const seoPomo = document.getElementById('seo-content-pomo');

function updateModeUI(toClock: boolean, updateHistory: boolean = true) {
  if (toClock) {
    iconClock?.classList.remove('hidden');
    iconTimer?.classList.add('hidden');

    seoClock?.classList.remove('hidden');
    seoPomo?.classList.add('hidden');

    // Fade out Pomodoro timer
    viewPomo?.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
      viewPomo?.classList.add('hidden');
      viewClock?.classList.remove('hidden');
      // Force browser layout reflow
      if (viewClock) {
        (viewClock as HTMLElement).offsetHeight;
      }
      viewClock?.classList.remove('opacity-0', 'pointer-events-none');
    }, 300);

    if (updateHistory && window.location.pathname !== '/') {
      window.history.pushState({ mode: 'clock' }, '', '/');
    }
  } else {
    iconClock?.classList.add('hidden');
    iconTimer?.classList.remove('hidden');

    seoClock?.classList.add('hidden');
    seoPomo?.classList.remove('hidden');

    // Fade out Clock widget
    viewClock?.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
      viewClock?.classList.add('hidden');
      viewPomo?.classList.remove('hidden');
      // Force browser layout reflow
      if (viewPomo) {
        (viewPomo as HTMLElement).offsetHeight;
      }
      viewPomo?.classList.remove('opacity-0', 'pointer-events-none');
    }, 300);

    if (updateHistory && !window.location.pathname.endsWith('/pomodoro') && !window.location.pathname.endsWith('/pomodoro/')) {
      window.history.pushState({ mode: 'pomodoro' }, '', '/pomodoro/');
    }
  }
}

// Handle click on Mode Switcher
modeBtn?.addEventListener('click', () => {
  isClockMode = !isClockMode;
  updateModeUI(isClockMode, true);
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  const isPomo = window.location.pathname.endsWith('/pomodoro') || window.location.pathname.endsWith('/pomodoro/');
  isClockMode = !isPomo;
  updateModeUI(isClockMode, false);
});

// 3. YouTube Ambient Sound Logic
let player: any;
let isMusicPlaying = false;
let currentVideoId = localStorage.getItem('aesthetic-yt-id') || '';

const musicBtn = document.getElementById('ctrl-music');
const musicPlayIcon = document.querySelector('.music-play');
const musicPauseIcon = document.querySelector('.music-pause');
const ytInput = document.getElementById('yt-id-input') as HTMLInputElement;
const musicSettingsBtn = document.getElementById('ctrl-music-settings');
const ytSettingsPanel = document.getElementById('yt-settings-panel');
const ytSaveBtn = document.getElementById('yt-save-btn');
const musicTutorial = document.getElementById('music-tutorial');

if (ytInput) ytInput.value = currentVideoId;

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

(window as any).onYouTubeIframeAPIReady = function () {
  try {
    player = new (window as any).YT.Player('yt-player', {
      height: '100%',
      width: '100%',
      videoId: currentVideoId,
      playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1, 'loop': 1, 'playlist': currentVideoId },
      events: {
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
  } catch (err) {
    console.error("YouTube Player failed to initialize: ", err);
  }
};

function onPlayerError(event: any) {
  console.error("YouTube IFrame API encountered an error (Code: " + event.data + "). Safe degradation enabled.");
}

function onPlayerStateChange(event: any) {
  if (event.data === (window as any).YT.PlayerState.PLAYING) {
    isMusicPlaying = true;
    musicPlayIcon?.classList.add('hidden');
    musicPauseIcon?.classList.remove('hidden');
    musicBtn?.classList.replace('text-mute', 'text-link'); // Highlight when playing
  } else {
    isMusicPlaying = false;
    musicPauseIcon?.classList.add('hidden');
    musicPlayIcon?.classList.remove('hidden');
    musicBtn?.classList.replace('text-link', 'text-mute');
  }
}

// Expose volume ducking method for Pomodoro chime notification
let isDucking = false;
let duckOriginalVolume = 100;
let duckTimeoutId: any = null;

(window as any).duckYouTubeVolume = function (durationMs: number = 1800) {
  if (!player || typeof player.getVolume !== 'function' || typeof player.setVolume !== 'function') return;
  try {
    // Clear any pending timeouts
    if (duckTimeoutId) {
      clearTimeout(duckTimeoutId);
      duckTimeoutId = null;
    }

    // If not already ducking, capture the true original volume
    if (!isDucking) {
      duckOriginalVolume = player.getVolume();
      isDucking = true;
    }

    const targetVolume = Math.round(duckOriginalVolume * 0.15); // Duck to 15% of original volume (better contrast for chime)

    // Set volume instantly to avoid postMessage throttling delays
    player.setVolume(targetVolume);

    duckTimeoutId = setTimeout(() => {
      player.setVolume(duckOriginalVolume);
      isDucking = false;
      duckTimeoutId = null;
    }, durationMs);
  } catch (err) {
    console.error("Ducking failed: ", err);
    isDucking = false;
  }
};

musicBtn?.addEventListener('click', () => {
  if (!currentVideoId) {
    // Run the music tutorial again
    localStorage.removeItem('aesthetic-tutorial-seen');
    musicTutorial?.classList.remove('hidden');
    return;
  }
  if (!player || typeof player.getPlayerState !== 'function') return;
  if (isMusicPlaying) player.pauseVideo();
  else player.playVideo();
});

// Hide tutorial permanently if they click settings
if (localStorage.getItem('aesthetic-tutorial-seen')) {
  musicTutorial?.classList.add('hidden');
}

musicSettingsBtn?.addEventListener('click', () => {
  musicTutorial?.classList.add('hidden');
  localStorage.setItem('aesthetic-tutorial-seen', 'true');

  const isVisible = ytSettingsPanel?.classList.contains('opacity-100');
  if (isVisible) {
    ytSettingsPanel?.classList.remove('opacity-100', 'visible');
    ytSettingsPanel?.classList.add('opacity-0', 'invisible');
    setTimeout(() => {
      if (ytSettingsPanel?.classList.contains('opacity-0')) {
        ytSettingsPanel?.classList.add('hidden');
      }
    }, 300);
  } else {
    ytSettingsPanel?.classList.remove('hidden');
    // Force reflow for transition
    if (ytSettingsPanel) {
      (ytSettingsPanel as HTMLElement).offsetHeight;
    }
    ytSettingsPanel?.classList.remove('opacity-0', 'invisible');
    ytSettingsPanel?.classList.add('opacity-100', 'visible');
  }
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (ytSettingsPanel?.classList.contains('opacity-100')) {
    if (!ytSettingsPanel.contains(target) && !musicSettingsBtn?.contains(target)) {
      ytSettingsPanel?.classList.remove('opacity-100', 'visible');
      ytSettingsPanel?.classList.add('opacity-0', 'invisible');
      setTimeout(() => {
        if (ytSettingsPanel?.classList.contains('opacity-0')) {
          ytSettingsPanel?.classList.add('hidden');
        }
      }, 300);
    }
  }
});

function extractYouTubeId(url: string) {
  const cleanId = url.trim();
  if (cleanId.length === 11 && !cleanId.includes('/') && !cleanId.includes('?')) {
    return cleanId;
  }
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const match = cleanId.match(regExp);
  return (match && match[1] && match[1].length === 11) ? match[1] : cleanId;
}

ytSaveBtn?.addEventListener('click', () => {
  const val = ytInput?.value.trim();
  if (val && player) {
    currentVideoId = extractYouTubeId(val);
    localStorage.setItem('aesthetic-yt-id', currentVideoId);
    player.loadVideoById(currentVideoId);
    player.setLoop(true);
    player.playVideo();
    ytSettingsPanel?.classList.remove('opacity-100', 'visible');
    ytSettingsPanel?.classList.add('opacity-0', 'invisible');
    setTimeout(() => {
      if (ytSettingsPanel?.classList.contains('opacity-0')) {
        ytSettingsPanel?.classList.add('hidden');
      }
    }, 300);
  }
});

// 4. Cinematic Zen Mode Transition
let isZen = false;
const zenBtn = document.getElementById('ctrl-zen');
const floatingControls = document.getElementById('floating-controls');
const centerDisplay = document.getElementById('center-display');
const mainContainer = document.getElementById('main-container');
const zenIndicator = document.getElementById('zen-indicator');
const blobs = [document.getElementById('blob1'), document.getElementById('blob2'), document.getElementById('blob3')];

// Randomize background blob starting positions on load
const animationDurations = [25, 30, 35];
blobs.forEach((blob, index) => {
  if (blob) {
    const duration = animationDurations[index];
    const randomDelay = Math.random() * -duration;
    blob.style.animationDelay = `${randomDelay}s`;
  }
});

// Video Player Picture-in-Picture Toggle
const showVideoToggle = document.getElementById('ctrl-show-video-toggle') as HTMLInputElement;
const ytPlayerContainer = document.getElementById('yt-player-container');
let showVideo = localStorage.getItem('aesthetic-show-video') === 'true'; // default to false

if (showVideoToggle) {
  showVideoToggle.checked = showVideo;
}

function updatePlayerVisibility() {
  if (!ytPlayerContainer) return;
  if (showVideo && !isZen) {
    ytPlayerContainer.classList.remove('translate-x-24', 'opacity-0', 'pointer-events-none');
  } else {
    ytPlayerContainer.classList.add('translate-x-24', 'opacity-0', 'pointer-events-none');
  }
}

showVideoToggle?.addEventListener('change', (e) => {
  showVideo = (e.target as HTMLInputElement).checked;
  localStorage.setItem('aesthetic-show-video', showVideo ? 'true' : 'false');
  updatePlayerVisibility();
});

const ytPlayerClose = document.getElementById('yt-player-close');
ytPlayerClose?.addEventListener('click', () => {
  showVideo = false;
  localStorage.setItem('aesthetic-show-video', 'false');
  if (showVideoToggle) {
    showVideoToggle.checked = false;
  }
  updatePlayerVisibility();
});

// Video Player Expand/Collapse
const ytPlayerExpand = document.getElementById('yt-player-expand');
const playerExpandIcon = document.querySelector('.player-expand-icon');
const playerCollapseIcon = document.querySelector('.player-collapse-icon');
let playerExpanded = localStorage.getItem('aesthetic-player-expanded') === 'true';

function updatePlayerSize() {
  if (!ytPlayerContainer) return;
  const normalClasses = ['w-[160px]', 'h-[90px]', 'sm:w-[240px]', 'sm:h-[135px]', 'md:w-[320px]', 'md:h-[180px]'];
  const expandedClasses = ['w-[280px]', 'h-[157px]', 'sm:w-[480px]', 'sm:h-[270px]', 'md:w-[640px]', 'md:h-[360px]'];

  if (playerExpanded) {
    ytPlayerContainer.classList.remove(...normalClasses);
    ytPlayerContainer.classList.add(...expandedClasses);
    playerExpandIcon?.classList.add('hidden');
    playerCollapseIcon?.classList.remove('hidden');
  } else {
    ytPlayerContainer.classList.remove(...expandedClasses);
    ytPlayerContainer.classList.add(...normalClasses);
    playerCollapseIcon?.classList.add('hidden');
    playerExpandIcon?.classList.remove('hidden');
  }
}

ytPlayerExpand?.addEventListener('click', () => {
  playerExpanded = !playerExpanded;
  localStorage.setItem('aesthetic-player-expanded', playerExpanded ? 'true' : 'false');
  updatePlayerSize();
});

// Video Player Fullscreen Toggle
const ytPlayerFullscreen = document.getElementById('yt-player-fullscreen');
const playerFullscreenIcon = document.querySelector('.player-fullscreen-icon');
const playerExitFullscreenIcon = document.querySelector('.player-exit-fullscreen-icon');

function togglePlayerFullscreen() {
  if (!ytPlayerContainer) return;

  if (!document.fullscreenElement) {
    ytPlayerContainer.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable player fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen().catch((err) => {
      console.error(`Error attempting to exit player fullscreen: ${err.message}`);
    });
  }
}

ytPlayerFullscreen?.addEventListener('click', togglePlayerFullscreen);

// Monitor fullscreen change events to update player icons
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement === ytPlayerContainer) {
    playerFullscreenIcon?.classList.add('hidden');
    playerExitFullscreenIcon?.classList.remove('hidden');
  } else if (!document.fullscreenElement) {
    playerExitFullscreenIcon?.classList.add('hidden');
    playerFullscreenIcon?.classList.remove('hidden');
  }
});

// Run initial updates
updatePlayerVisibility();
updatePlayerSize();

// AdSense Management for Zen Mode
const adSlots = document.querySelectorAll('.ad-slot');
const initialAdTemplates = adSlots ? Array.from(adSlots).map(slot => (slot as any).innerHTML || '') : [];
let adUnmountTimer: any = null;
let adsUnmounted = false;
let isAdBlockActive = false;

// Helper to generate AdBlock message templates based on slot type
function getAdBlockTemplate(slot: Element) {
  if (slot.classList.contains('top-4')) {
    // Horizontal Leaderboard message
    return `
      <div class="relative w-full h-full bg-canvas text-ink flex items-center justify-between p-2 md:p-4 text-xs md:text-sm font-medium border border-red-500/20 rounded">
        <div class="flex items-center space-x-2">
          <span class="text-red-500 text-base md:text-lg">🛡️</span>
          <div class="flex flex-col text-left">
            <span class="font-semibold text-ink leading-tight">AdBlock Active</span>
            <span class="text-[10px] md:text-xs text-mute leading-normal">To support our free aesthetic clock, please whitelist us (Zen Mode is always ad-free).</span>
          </div>
        </div>
        <button onclick="window.location.reload()" class="bg-canvas-soft hover:bg-hairline text-ink border border-hairline text-[10px] md:text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">Refresh</button>
      </div>
    `;
  } else {
    // Vertical Skyscraper message
    return `
      <div class="relative w-full h-full bg-canvas text-ink flex flex-col items-center justify-center p-4 text-center text-xs border border-red-500/20 rounded">
        <span class="text-red-500 text-3xl mb-4">🛡️</span>
        <span class="font-semibold text-sm text-ink mb-2">AdBlock Active</span>
        <p class="text-mute text-[11px] leading-relaxed mb-6">We rely on ad revenue to keep this clock free and running. Please consider whitelisting us (Zen Mode is always 100% ad-free to keep your experience unobtrusive).</p>
        <button onclick="window.location.reload()" class="w-full bg-canvas-soft hover:bg-hairline text-ink border border-hairline text-xs py-2 rounded transition-colors mt-auto">Refresh Page</button>
      </div>
    `;
  }
}

// Detect AdBlock using multiple methods
async function checkAdBlock() {
  let adBlockDetected = false;

  // Method 1: Fetch check for standard Google AdSense script (catches network blocks)
  try {
    await fetch(
      new Request("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", {
        method: "HEAD",
        mode: "no-cors",
      })
    );
  } catch (error) {
    adBlockDetected = true;
  }

  // Method 2: DOM bait check for class/CSS blocking
  if (!adBlockDetected) {
    try {
      const bait = document.createElement('div');
      bait.className = 'pub_300x250 pub_300x250m sub_ad adsbox ad-image ad-placement doubleclick ad-zone';
      bait.setAttribute('style', 'width: 1px; height: 1px; position: absolute; left: -9999px; top: -9999px;');
      document.body.appendChild(bait);

      await new Promise(resolve => setTimeout(resolve, 100));

      const computedStyle = window.getComputedStyle(bait);
      if (
        computedStyle.display === 'none' ||
        computedStyle.visibility === 'hidden' ||
        bait.offsetParent === null ||
        bait.offsetHeight === 0
      ) {
        adBlockDetected = true;
      }
      document.body.removeChild(bait);
    } catch (e) {
      // Safe fallback
    }
  }

  if (adBlockDetected) {
    isAdBlockActive = true;
    if (adSlots) {
      adSlots.forEach(slot => {
        if (slot) {
          slot.innerHTML = getAdBlockTemplate(slot);
        }
      });
    }
  }
}

// Run the detection on load
checkAdBlock();

zenBtn?.addEventListener('click', enterZen);

function enterZen() {
  isZen = true;
  updatePlayerVisibility();

  // Scale up and add glow to the display
  if (centerDisplay) centerDisplay.dataset.zen = 'true';
  if (mainContainer) mainContainer.dataset.zen = 'true';

  // Show indicator
  zenIndicator?.classList.replace('opacity-0', 'opacity-100');
  setTimeout(() => {
    zenIndicator?.classList.replace('opacity-100', 'opacity-0');
  }, 4000);

  const zenViewport = document.getElementById('zen-viewport');
  if (zenViewport) {
    if (zenViewport.requestFullscreen) {
      zenViewport.requestFullscreen().catch(() => { });
    } else if ((zenViewport as any).webkitRequestFullscreen) {
      (zenViewport as any).webkitRequestFullscreen();
    }
  }
}

function exitZen() {
  isZen = false;
  updatePlayerVisibility();

  // Restore display scale
  if (centerDisplay) centerDisplay.dataset.zen = 'false';
  if (mainContainer) mainContainer.dataset.zen = 'false';

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => { });
  } else if ((document as any).webkitFullscreenElement) {
    (document as any).webkitExitFullscreen();
  }
}

// Escape key / Exiting fullscreen manually also exits Zen mode
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && isZen) {
    exitZen();
  }
});
document.addEventListener('webkitfullscreenchange', () => {
  if (!(document as any).webkitFullscreenElement && isZen) {
    exitZen();
  }
});

// Also allow clicking anywhere on the document to exit Zen Mode
document.addEventListener('click', (e) => {
  // Make sure we only exit if Zen mode is active and they aren't clicking the floating controls
  if (isZen) {
    const target = e.target as HTMLElement;
    if (!floatingControls?.contains(target)) {
      exitZen();
    }
  }
});
