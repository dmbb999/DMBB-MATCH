/* ============================================================================
   CHRISTMAS PARTY MEMORY MATCH — PICTURE CONFIGURATION
   ============================================================================
   HOW TO USE YOUR OWN PICTURES:
   1. Place your photos inside the "images" folder (next to index.html).
   2. Edit PICTURE_FILES below so each filename matches a photo inside
      your "images" folder (supports .jpg, .jpeg, .png, .webp, .gif).
   3. To ADD pairs: add more filenames to PICTURE_FILES.
   4. To REMOVE pairs: delete filenames from PICTURE_FILES.
   5. Save this file and refresh index.html in your browser.
      Works 100% offline — no internet connection required!
   ============================================================================ */

const IMAGE_FOLDER = "images/";

const PICTURE_FILES = [
  "photo1.jpg",
  "photo2.jpg",
  "photo3.jpg",
  "photo4.jpg",
  "photo5.jpg",
  "photo6.jpg",
  "photo7.jpg",
  "photo8.jpg",
  "photo9.jpg",
  "photo10.jpg",
  "photo11.jpg",
  "photo12.jpg"
];

// Default number of pairs when the page loads (automatically adjusted if fewer pictures exist)
const DEFAULT_PAIRS = 8;

// Delay in milliseconds before two non-matching cards flip back face down
const MISMATCH_FLIP_DELAY_MS = 1050;

/* ============================================================================
   GAME ENGINE (No need to edit below unless customizing behavior)
   ============================================================================ */
(function () {
  "use strict";

  // DOM Elements
  const cardGridEl = document.getElementById("card-grid");
  const movesCountEl = document.getElementById("moves-count");
  const matchedCountEl = document.getElementById("matched-count");
  const totalPairsCountEl = document.getElementById("total-pairs-count");
  const remainingCountEl = document.getElementById("remaining-count");
  const pairsSelectEl = document.getElementById("pairs-select");
  const restartBtn = document.getElementById("restart-btn");
  const soundToggleBtn = document.getElementById("sound-toggle");
  const fallbackNoticeEl = document.getElementById("fallback-notice");
  const noticeSetupBtn = document.getElementById("notice-setup-btn");

  // Victory Modal Elements
  const victoryModalEl = document.getElementById("victory-modal");
  const finalMovesEl = document.getElementById("final-moves");
  const finalPairsEl = document.getElementById("final-pairs");
  const finalAccuracyEl = document.getElementById("final-accuracy");
  const playAgainBtn = document.getElementById("play-again-btn");
  const viewBoardBtn = document.getElementById("view-board-btn");
  const confettiCanvas = document.getElementById("confetti-canvas");

  // Setup Guide Modal Elements
  const guideModalEl = document.getElementById("guide-modal");
  const guideOpenBtn = document.getElementById("guide-open-btn");
  const guideCloseBtn = document.getElementById("guide-close-btn");
  const guideDoneBtn = document.getElementById("guide-done-btn");
  const localFilesInput = document.getElementById("local-files-input");
  const localFilesStatusEl = document.getElementById("local-files-status");
  const resetFolderBtn = document.getElementById("reset-folder-btn");

  // Game State
  const state = {
    cards: [],
    flippedIndices: [],
    matchedPairs: 0,
    totalPairs: 0,
    moves: 0,
    isLocked: false,
    soundEnabled: true,
    flipTimerId: null,
    victoryTimerId: null,
    confettiRafId: null,
    customObjectUrls: [],
    activeSourceList: buildFolderPictureList(),
    missingImageCount: 0
  };

  let audioCtx = null;

  function buildFolderPictureList() {
    return PICTURE_FILES.map(function (filename, idx) {
      const cleanName = String(filename).trim();
      return {
        id: "folder-" + idx,
        label: formatLabelFromFilename(cleanName, idx + 1),
        filename: cleanName,
        src: IMAGE_FOLDER + cleanName
      };
    }).filter(function (item) {
      return item.filename.length > 0;
    });
  }

  function formatLabelFromFilename(filename, fallbackNumber) {
    const withoutExt = filename.replace(/\.[^/.]+$/, "");
    const readable = withoutExt.replace(/[-_]+/g, " ").trim();
    return readable || "Picture " + fallbackNumber;
  }

  function shuffleArray(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  function clearPendingTimers() {
    if (state.flipTimerId !== null) {
      clearTimeout(state.flipTimerId);
      state.flipTimerId = null;
    }
    if (state.victoryTimerId !== null) {
      clearTimeout(state.victoryTimerId);
      state.victoryTimerId = null;
    }
    stopConfetti();
  }

  /* --------------------------------------------------------------------------
     Pair Options Dropdown (Adapts automatically to PICTURE_FILES count)
     -------------------------------------------------------------------------- */
  function populatePairOptions() {
    const maxPairs = state.activeSourceList.length;
    const presetCounts = [2, 4, 6, 8, 10, 12, 15, 18, 20, 24];
    const options = presetCounts.filter(function (n) {
      return n <= maxPairs;
    });

    if (maxPairs >= 2 && options.indexOf(maxPairs) === -1) {
      options.push(maxPairs);
      options.sort(function (a, b) {
        return a - b;
      });
    }

    const previousValue = parseInt(pairsSelectEl.value, 10);
    pairsSelectEl.innerHTML = "";

    options.forEach(function (pairCount) {
      const optionEl = document.createElement("option");
      optionEl.value = String(pairCount);
      optionEl.textContent = pairCount + " Pairs (" + pairCount * 2 + " Cards)";
      pairsSelectEl.appendChild(optionEl);
    });

    if (options.length === 0) {
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "0";
      emptyOpt.textContent = "Add 2+ Pictures";
      pairsSelectEl.appendChild(emptyOpt);
      return;
    }

    if (options.indexOf(previousValue) !== -1) {
      pairsSelectEl.value = String(previousValue);
    } else if (options.indexOf(DEFAULT_PAIRS) !== -1) {
      pairsSelectEl.value = String(DEFAULT_PAIRS);
    } else {
      pairsSelectEl.value = String(options[options.length - 1]);
    }
  }

  /* --------------------------------------------------------------------------
     Responsive Grid Math (Maximizes card size for projectors & phones)
     -------------------------------------------------------------------------- */
  function updateGridDimensions() {
    const totalCards = state.cards.length;
    if (totalCards === 0) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    let cols = 4;

    if (width <= 640) {
      cols = totalCards <= 8 ? 2 : 3;
    } else {
      // Find the factor pair closest to the stage aspect ratio
      const stageAspect = (width * 0.92) / Math.max(height - 110, 320);
      let bestCols = Math.ceil(Math.sqrt(totalCards * stageAspect));
      let bestScore = Infinity;

      for (let c = 2; c <= Math.min(8, totalCards); c++) {
        const r = Math.ceil(totalCards / c);
        const remainder = (c * r - totalCards) * 1.5;
        const gridAspect = c / r;
        const score = Math.abs(gridAspect - stageAspect) + remainder;
        if (score < bestScore) {
          bestScore = score;
          bestCols = c;
        }
      }
      cols = bestCols;
    }

    const rows = Math.ceil(totalCards / cols);
    cardGridEl.style.setProperty("--cols", String(cols));
    cardGridEl.style.setProperty("--rows", String(rows));
  }

  /* --------------------------------------------------------------------------
     Start / Restart Game
     -------------------------------------------------------------------------- */
  function startNewGame() {
    clearPendingTimers();
    hideVictoryModal();

    const availablePictures = state.activeSourceList;
    const requestedPairs = parseInt(pairsSelectEl.value, 10) || 0;
    const pairCount = Math.min(requestedPairs, availablePictures.length);

    state.moves = 0;
    state.matchedPairs = 0;
    state.totalPairs = pairCount;
    state.flippedIndices = [];
    state.isLocked = false;
    state.missingImageCount = 0;
    fallbackNoticeEl.hidden = true;

    if (pairCount < 1) {
      state.cards = [];
      renderBoard();
      updateScoreboard();
      return;
    }

    // Shuffle available pictures first so rounds with fewer pairs vary which photos appear
    const selectedPictures = shuffleArray(availablePictures).slice(0, pairCount);

    // Duplicate each selected picture automatically to create matching pairs
    const deck = [];
    selectedPictures.forEach(function (pic, pairIndex) {
      const pairData = {
        pairId: pic.id,
        pairNumber: pairIndex + 1,
        label: pic.label,
        filename: pic.filename,
        src: pic.src,
        isFlipped: false,
        isMatched: false
      };
      deck.push(Object.assign({}, pairData));
      deck.push(Object.assign({}, pairData));
    });

    // Shuffle the full deck every time a new game starts
    state.cards = shuffleArray(deck);

    updateGridDimensions();
    renderBoard();
    updateScoreboard();
  }

  function updateScoreboard() {
    const remaining = Math.max(0, state.totalPairs - state.matchedPairs);
    movesCountEl.textContent = String(state.moves);
    matchedCountEl.textContent = String(state.matchedPairs);
    totalPairsCountEl.textContent = String(state.totalPairs);
    remainingCountEl.textContent = String(remaining);
  }

  /* --------------------------------------------------------------------------
     Card Rendering
     -------------------------------------------------------------------------- */
  function createCardBackMotifSvg() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("card-back-motif");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute(
      "d",
      "M16 3V29M3 16H29M6.8 6.8L25.2 25.2M25.2 6.8L6.8 25.2M13 6L16 9L19 6M13 26L16 23L19 26M6 13L9 16L6 19M26 13L23 16L26 19"
    );
    path.setAttribute("stroke", "#e4b84e");
    path.setAttribute("stroke-width", "1.7");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function createFallbackContent(card) {
    const fallback = document.createElement("div");
    fallback.className = "card-fallback";

    const svgNS = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(svgNS, "svg");
    icon.setAttribute("viewBox", "0 0 40 40");
    icon.setAttribute("fill", "none");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("card-fallback-icon");

    const tree = document.createElementNS(svgNS, "path");
    tree.setAttribute(
      "d",
      "M20 4L28 15H23L31 25H25L33 34H7L15 25H9L17 15H12L20 4Z"
    );
    tree.setAttribute("fill", card.pairNumber % 2 === 0 ? "#8f1822" : "#134634");
    tree.setAttribute("stroke", "#e4b84e");
    tree.setAttribute("stroke-width", "1.5");
    tree.setAttribute("stroke-linejoin", "round");
    icon.appendChild(tree);

    const title = document.createElement("div");
    title.className = "card-fallback-title";
    title.textContent = card.label;

    const fileNote = document.createElement("div");
    fileNote.className = "card-fallback-file";
    fileNote.textContent = card.filename;

    fallback.appendChild(icon);
    fallback.appendChild(title);
    fallback.appendChild(fileNote);
    return fallback;
  }

  function renderBoard() {
    cardGridEl.innerHTML = "";

    state.cards.forEach(function (card, index) {
      const cardBtn = document.createElement("button");
      cardBtn.type = "button";
      cardBtn.className = "card";
      cardBtn.dataset.index = String(index);
      cardBtn.setAttribute("role", "gridcell");
      cardBtn.setAttribute("aria-label", "Card " + (index + 1) + ", face down");

      const inner = document.createElement("div");
      inner.className = "card-inner";

      // Face Down Back (with large projector-readable card number)
      const back = document.createElement("div");
      back.className = "card-face card-back";
      back.appendChild(createCardBackMotifSvg());

      const numberEl = document.createElement("span");
      numberEl.className = "card-number";
      numberEl.textContent = String(index + 1);
      back.appendChild(numberEl);

      // Face Up Picture Side
      const front = document.createElement("div");
      front.className = "card-face card-front";

      const imgWrap = document.createElement("div");
      imgWrap.className = "card-image-wrap";

      const img = document.createElement("img");
      img.className = "card-image";
      img.src = card.src;
      img.alt = card.label;
      img.draggable = false;

      img.addEventListener("error", function () {
        // Gracefully show a clean festive label card if the local file is not added yet
        if (img.parentNode === imgWrap) {
          imgWrap.removeChild(img);
          imgWrap.appendChild(createFallbackContent(card));
          state.missingImageCount += 1;
          fallbackNoticeEl.hidden = false;
        }
      });

      const matchBadge = document.createElement("span");
      matchBadge.className = "card-match-badge";
      matchBadge.textContent = "Matched";

      imgWrap.appendChild(img);
      imgWrap.appendChild(matchBadge);
      front.appendChild(imgWrap);

      inner.appendChild(back);
      inner.appendChild(front);
      cardBtn.appendChild(inner);

      cardBtn.addEventListener("click", function () {
        handleCardClick(index);
      });

      cardGridEl.appendChild(cardBtn);
    });
  }

  /* --------------------------------------------------------------------------
     Card Flip & Match Logic
     -------------------------------------------------------------------------- */
  function handleCardClick(index) {
    if (state.isLocked) {
      return;
    }

    const card = state.cards[index];
    if (!card || card.isFlipped || card.isMatched) {
      return;
    }

    const cardEl = cardGridEl.children[index];
    if (!cardEl) {
      return;
    }

    card.isFlipped = true;
    cardEl.classList.add("is-flipped");
    cardEl.setAttribute("aria-label", "Card " + (index + 1) + ", " + card.label);
    state.flippedIndices.push(index);
    playFlipSound();

    if (state.flippedIndices.length < 2) {
      return;
    }

    // Two cards are now revealed — count 1 move and evaluate
    state.moves += 1;
    updateScoreboard();

    const firstIdx = state.flippedIndices[0];
    const secondIdx = state.flippedIndices[1];
    const firstCard = state.cards[firstIdx];
    const secondCard = state.cards[secondIdx];

    if (firstCard.pairId === secondCard.pairId) {
      // Match found!
      firstCard.isMatched = true;
      secondCard.isMatched = true;

      const firstEl = cardGridEl.children[firstIdx];
      const secondEl = cardGridEl.children[secondIdx];
      if (firstEl) {
        firstEl.classList.add("is-matched");
        firstEl.disabled = true;
        firstEl.setAttribute("aria-label", "Card " + (firstIdx + 1) + ", matched " + firstCard.label);
      }
      if (secondEl) {
        secondEl.classList.add("is-matched");
        secondEl.disabled = true;
        secondEl.setAttribute("aria-label", "Card " + (secondIdx + 1) + ", matched " + secondCard.label);
      }

      state.matchedPairs += 1;
      state.flippedIndices = [];
      updateScoreboard();
      playMatchSound();

      if (state.matchedPairs === state.totalPairs) {
        state.isLocked = true;
        state.victoryTimerId = setTimeout(showVictoryModal, 480);
      }
    } else {
      // Not a match — lock board briefly, then flip both cards back down
      state.isLocked = true;
      playMismatchSound();

      state.flipTimerId = setTimeout(function () {
        firstCard.isFlipped = false;
        secondCard.isFlipped = false;

        const firstEl = cardGridEl.children[firstIdx];
        const secondEl = cardGridEl.children[secondIdx];
        if (firstEl) {
          firstEl.classList.remove("is-flipped");
          firstEl.setAttribute("aria-label", "Card " + (firstIdx + 1) + ", face down");
        }
        if (secondEl) {
          secondEl.classList.remove("is-flipped");
          secondEl.setAttribute("aria-label", "Card " + (secondIdx + 1) + ", face down");
        }

        state.flippedIndices = [];
        state.isLocked = false;
        state.flipTimerId = null;
      }, MISMATCH_FLIP_DELAY_MS);
    }
  }

  /* --------------------------------------------------------------------------
     Victory Overlay & Celebratory Confetti
     -------------------------------------------------------------------------- */
  function showVictoryModal() {
    const accuracy = state.moves > 0
      ? Math.min(100, Math.round((state.totalPairs / state.moves) * 100))
      : 100;

    finalMovesEl.textContent = String(state.moves);
    finalPairsEl.textContent = String(state.totalPairs);
    finalAccuracyEl.textContent = accuracy + "%";

    victoryModalEl.hidden = false;
    playVictorySound();
    startConfetti();
    playAgainBtn.focus();
  }

  function hideVictoryModal() {
    victoryModalEl.hidden = true;
    stopConfetti();
  }

  function startConfetti() {
    if (
      !confettiCanvas ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }

    const ctx = confettiCanvas.getContext("2d");
    if (!ctx) {
      return;
    }

    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const colors = ["#e4b84e", "#c42331", "#fcf8ef", "#2e8b57"];
    const pieces = [];
    for (let i = 0; i < 90; i++) {
      pieces.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        vy: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 1.8,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.12,
        color: colors[i % colors.length]
      });
    }

    function drawFrame() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      pieces.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        if (p.y > confettiCanvas.height + 20) {
          p.y = -15;
          p.x = Math.random() * confettiCanvas.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      state.confettiRafId = requestAnimationFrame(drawFrame);
    }

    stopConfetti();
    state.confettiRafId = requestAnimationFrame(drawFrame);
  }

  function stopConfetti() {
    if (state.confettiRafId !== null) {
      cancelAnimationFrame(state.confettiRafId);
      state.confettiRafId = null;
    }
    if (confettiCanvas) {
      const ctx = confettiCanvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
  }

  /* --------------------------------------------------------------------------
     Offline Web Audio API Sound Effects (Zero External Files)
     -------------------------------------------------------------------------- */
  function getAudioContext() {
    if (!state.soundEnabled) {
      return null;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playTone(freq, duration, type, startTimeOffset, gainPeak) {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime + (startTimeOffset || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak || 0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playFlipSound() {
    playTone(520, 0.08, "triangle", 0, 0.05);
  }

  function playMatchSound() {
    playTone(523.25, 0.14, "sine", 0, 0.08);
    playTone(659.25, 0.16, "sine", 0.08, 0.08);
    playTone(783.99, 0.24, "sine", 0.16, 0.09);
  }

  function playMismatchSound() {
    playTone(260, 0.14, "triangle", 0.05, 0.04);
  }

  function playVictorySound() {
    // Play a cheerful festive arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const offsets = [0, 0.11, 0.22, 0.34, 0.5, 0.64];
    notes.forEach(function (note, idx) {
      playTone(note, idx === notes.length - 1 ? 0.45 : 0.16, "sine", offsets[idx], 0.09);
    });
  }

  /* --------------------------------------------------------------------------
     Picture Setup Guide & Quick Local Photo Loader
     -------------------------------------------------------------------------- */
  function openGuideModal() {
    guideModalEl.hidden = false;
    guideCloseBtn.focus();
  }

  function closeGuideModal() {
    guideModalEl.hidden = true;
    guideOpenBtn.focus();
  }

  function revokeCustomObjectUrls() {
    state.customObjectUrls.forEach(function (url) {
      URL.revokeObjectURL(url);
    });
    state.customObjectUrls = [];
  }

  function handleLocalFilesSelected(event) {
    const files = Array.from(event.target.files || []).filter(function (file) {
      return file.type.indexOf("image/") === 0;
    });

    if (files.length < 2) {
      localFilesStatusEl.textContent = "Please choose at least 2 image files to create pairs.";
      localFilesStatusEl.hidden = false;
      return;
    }

    revokeCustomObjectUrls();

    state.activeSourceList = files.map(function (file, idx) {
      const url = URL.createObjectURL(file);
      state.customObjectUrls.push(url);
      return {
        id: "local-" + idx,
        label: formatLabelFromFilename(file.name, idx + 1),
        filename: file.name,
        src: url
      };
    });

    localFilesStatusEl.textContent = "Loaded " + files.length + " pictures for this session.";
    localFilesStatusEl.hidden = false;
    resetFolderBtn.hidden = false;
    populatePairOptions();
    closeGuideModal();
    startNewGame();
  }

  function resetToImagesFolder() {
    revokeCustomObjectUrls();
    localFilesInput.value = "";
    localFilesStatusEl.textContent = "";
    localFilesStatusEl.hidden = true;
    state.activeSourceList = buildFolderPictureList();
    resetFolderBtn.hidden = true;
    populatePairOptions();
    closeGuideModal();
    startNewGame();
  }

  /* --------------------------------------------------------------------------
     Event Listeners
     -------------------------------------------------------------------------- */
  pairsSelectEl.addEventListener("change", startNewGame);
  restartBtn.addEventListener("click", startNewGame);
  playAgainBtn.addEventListener("click", startNewGame);
  viewBoardBtn.addEventListener("click", hideVictoryModal);

  soundToggleBtn.addEventListener("click", function () {
    state.soundEnabled = !state.soundEnabled;
    soundToggleBtn.textContent = state.soundEnabled ? "Sound On" : "Sound Off";
    soundToggleBtn.setAttribute("aria-pressed", String(state.soundEnabled));
  });

  guideOpenBtn.addEventListener("click", openGuideModal);
  noticeSetupBtn.addEventListener("click", openGuideModal);
  guideCloseBtn.addEventListener("click", closeGuideModal);
  guideDoneBtn.addEventListener("click", closeGuideModal);

  guideModalEl.addEventListener("click", function (event) {
    if (event.target === guideModalEl) {
      closeGuideModal();
    }
  });

  victoryModalEl.addEventListener("click", function (event) {
    if (event.target === victoryModalEl) {
      hideVictoryModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (!guideModalEl.hidden) {
        closeGuideModal();
      } else if (!victoryModalEl.hidden) {
        hideVictoryModal();
      }
    }
  });

  localFilesInput.addEventListener("change", handleLocalFilesSelected);
  resetFolderBtn.addEventListener("click", resetToImagesFolder);
  window.addEventListener("resize", updateGridDimensions);
  window.addEventListener("beforeunload", revokeCustomObjectUrls);

  // Initialize on load
  populatePairOptions();
  startNewGame();
})();
