/*
 * Quixel Megascans Fab Library Claimer
 * Community-maintained, unofficial. Not affiliated with Epic Games, Fab or Quixel.
 *
 * Run from the Chrome developer console at https://www.fab.com while logged in.
 * Default: preview only. To claim, explicitly change CLAIM_ENABLED to true.
 * This relies on undocumented Fab endpoints and may stop working at any time.
 */
(async function bulkClaimMegascans() {
  "use strict";

  const CLAIM_ENABLED = false; // Review results before changing this to true.
  const MAX_CLAIMS_PER_RUN = 100; // Use Infinity only after confirming a small batch.
  const DELAY_MS = 2000;
  const PAGE_DELAY_MS = 3000;
  const BASE = "https://www.fab.com/i/listings";
  const STORAGE_KEY = "quixel_megascans_bulk_v1"; // Compatible with previous version.

  if (location.hostname !== "www.fab.com") {
    console.error("Open https://www.fab.com and sign in first.");
    return;
  }
  if (window.quixelBulkRunning) {
    console.warn("The claimer is already running in this tab.");
    return;
  }
  window.quixelBulkRunning = true;
  window.stopQuixelBulk = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const stats = { pages: 0, scanned: 0, eligible: 0, claimed: 0, alreadyProcessed: 0, failed: 0 };

  function readState() {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return { cursor: null, completed: false, claimedIds: [] };
    const state = JSON.parse(value);
    if (!Array.isArray(state.claimedIds)) throw new Error("Saved progress is invalid.");
    return { cursor: state.cursor ?? null, completed: !!state.completed, claimedIds: state.claimedIds };
  }

  let state;
  try { state = readState(); }
  catch (err) {
    console.error("Saved progress cannot be read. Do not clear it until you back it up.", err);
    window.quixelBulkRunning = false;
    return;
  }
  const claimedIds = new Set(state.claimedIds);

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cursor: state.cursor,
      completed: state.completed,
      claimedIds: [...claimedIds]
    }));
  }

  function csrf() {
    const raw = document.cookie.split("; ").find((part) => part.startsWith("fab_csrftoken="));
    return raw ? raw.slice("fab_csrftoken=".length) : "";
  }

  async function api(path, options = {}) {
    const response = await fetch(`${BASE}/${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.method === "POST" ? { "x-csrftoken": csrf() } : {}),
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      const error = new Error(`HTTP ${response.status}: ${detail}`);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function search(cursor) {
    const params = new URLSearchParams({
      seller: "Quixel Megascans",
      sort_by: "-firstPublishedAt"
    });
    if (cursor) params.set("cursor", cursor);
    const page = await api(`search?${params}`);
    if (!Array.isArray(page.results)) throw new Error("Unexpected search response.");
    return page;
  }

  async function addItem(id, offerId) {
    const form = new FormData();
    form.append("offer_id", offerId);
    return api(`${encodeURIComponent(id)}/add-to-library`, { method: "POST", body: form });
  }

  const seenCursors = new Set();
  console.log("Quixel Megascans Fab Library Claimer");
  console.log("Mode:", CLAIM_ENABLED ? "CLAIM" : "PREVIEW ONLY");
  console.log("Already saved asset IDs:", claimedIds.size);

  try {
    if (state.completed) {
      console.log("Saved scan is marked complete. See README for restarting a scan.");
      return;
    }
    let previewed = 0;
    while (!window.stopQuixelBulk && (CLAIM_ENABLED ? stats.claimed : previewed) < MAX_CLAIMS_PER_RUN) {
      const page = await search(state.cursor);
      stats.pages++;
      if (page.results.length === 0) {
        // Empty pages can indicate a temporary search issue; don't mark completed.
        console.warn("Empty search page. Stopping without marking complete.");
        break;
      }
      for (const result of page.results) {
        if (window.stopQuixelBulk || (CLAIM_ENABLED ? stats.claimed : previewed) >= MAX_CLAIMS_PER_RUN) break;
        if (!result.uid) continue;
        if (claimedIds.has(result.uid)) { stats.alreadyProcessed++; continue; }
        stats.scanned++;
        try {
          const item = await api(encodeURIComponent(result.uid));
          // Search is scoped to the Quixel Megascans seller. Prices are not
          // consistently present in the API; this is not a paid-price validator.
          const offer = (item.licenses || []).find(l => l.slug === "professional" && l.offerId) ||
                        (item.licenses || []).find(l => l.slug === "personal" && l.offerId);
          if (!offer) { console.warn("No available offer:", item.title); continue; }
          stats.eligible++;
          if (!CLAIM_ENABLED) {
            previewed++;
            console.log(`[Preview ${previewed}/${MAX_CLAIMS_PER_RUN}]`, item.title, result.uid);
            continue;
          }
          await addItem(result.uid, offer.offerId);
          claimedIds.add(result.uid);
          stats.claimed++;
          saveState();
          console.log(`[Added ${stats.claimed}/${MAX_CLAIMS_PER_RUN}]`, item.title);
          await sleep(DELAY_MS);
        } catch (error) {
          stats.failed++;
          if (error.status === 409) {
            // A conflict is not necessarily ownership confirmation.
            console.warn("Conflict — verify in My Library:", result.uid);
          } else {
            console.error("Stopped on listing:", result.uid, error);
          }
          throw error; // Stop rather than hammering a failing endpoint.
        }
      }
      if (window.stopQuixelBulk || (CLAIM_ENABLED ? stats.claimed : previewed) >= MAX_CLAIMS_PER_RUN) break;
      const next = page.cursors?.next ?? null;
      if (!next) {
        if (CLAIM_ENABLED) {
          state.completed = true;
          state.cursor = null;
          saveState();
        }
        console.log("Reached final search page.");
        break;
      }
      if (next === state.cursor || seenCursors.has(next)) throw new Error("Pagination cursor loop detected.");
      seenCursors.add(next);
      if (CLAIM_ENABLED) { state.cursor = next; saveState(); }
      else { state.cursor = next; } // Preview cursor held only in memory.
      await sleep(PAGE_DELAY_MS);
    }
  } catch (error) {
    console.error("Stopped:", error.message);
  } finally {
    // IMPORTANT: A preview must not overwrite the claim resume cursor.
    if (CLAIM_ENABLED) saveState();
    window.quixelBulkRunning = false;
    console.table({ ...stats, savedAssetIds: claimedIds.size });
    console.log(CLAIM_ENABLED ? "Run again to resume; keep the same browser profile and account." : "Preview completed. Nothing was added to your library.");
  }
})();
