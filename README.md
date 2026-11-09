# Quixel Megascans → Fab Library Claimer

An **unofficial community script** to find Quixel Megascans listings on Fab and (when explicitly enabled) add their available license offers to your Fab library.

> **Not affiliated with or endorsed by Epic Games, Fab, or Quixel.** Uses undocumented Fab web endpoints that may change or stop working. Check Fab's terms and any applicable offer/license terms before using automation. You are responsible for your account and actions.

## Features

- Search limited to the **Quixel Megascans** seller.
- Preview mode by default (no account changes).
- Sequential library additions with delays.
- Stop after a configurable number of successful claims.
- Store successful listing IDs and a page cursor in browser `localStorage` to resume later.
- Stop on an unexpected request failure rather than repeatedly retrying.

## Requirements

- Chrome or another browser with Developer Tools.
- A signed-in account at `https://www.fab.com`.
- Only run code you have read and understand. **Do not paste access tokens, cookies, or credentials into issues.**

## Use

1. Sign in to [Fab](https://www.fab.com).
2. Open Developer Tools → **Console**.
3. Open `claim-megascans.js` in this repository and read it.
4. Paste its contents into the console and press Enter.
5. The default is a **preview** of up to 100 eligible offers: `CLAIM_ENABLED = false`.
6. Check listings manually to confirm they are free and covered by the licensing terms you want. The API response used here does **not** reliably expose pricing.
7. To actually add assets, change `CLAIM_ENABLED` to `true` in the script. Start with `MAX_CLAIMS_PER_RUN = 5` or `100`, confirm them in **My Library**, then increase the limit if appropriate. `Infinity` runs until the end of results or an error.

**This script does not purchase through checkout, but it sends authenticated add-to-library POST requests. It does not independently guarantee an offer is free.**

## Stop and resume

In the same tab's Console, run:

```js
window.stopQuixelBulk = true;
```

The script checks this flag between operations. Once stopped, you may close the tab. To resume, reopen Fab with the **same account and browser profile** and run the script again. Saved progress is stored under:

```text
quixel_megascans_bulk_v1
```

Only IDs successfully accepted by the add-to-library endpoint are stored as claimed. This is **not** an authoritative ownership check; previously owned items from another session or device may still be encountered. If a request fails, inspect it and resume only after resolving the issue.

### Back up progress

Before clearing site data or switching devices, while on Fab, run:

```js
copy(localStorage.getItem('quixel_megascans_bulk_v1'))
```

This copies progress JSON to your clipboard. Keep it private if you prefer; it contains listing IDs and a pagination cursor, not your account password.

### Re-scan after completion

Fab's collection can change. If your saved scan is marked complete, you can reset *only its completion flag/cursor* while retaining saved claimed IDs:

```js
const k = 'quixel_megascans_bulk_v1';
const s = JSON.parse(localStorage.getItem(k) || '{}');
s.completed = false;
s.cursor = null;
localStorage.setItem(k, JSON.stringify(s));
```

Run the claimer again afterward.

## Known limitations

- Fab's API is undocumented; search, pagination, license fields, or claiming may change.
- **No reliable price check**: only use the claim mode when you have confirmed the targeted offers are free.
- The script prefers a `professional` offer ID, then `personal`, when present. Review licenses before proceeding.
- Saved state is specific to the browser profile and should only be reused with the same Fab account.
- Claims may be subject to rate limits or terms. Do not reduce delays to evade limits.
- Cursor-based searches can change while the script runs; some items may be revisited or missed.
- A `409` response is reported as a conflict, not proof of ownership.

## Credits

Inspired by earlier community Fab/Quixel bulk-claim browser scripts. This implementation was adapted and tested interactively against the user's observed Fab responses in November 2026. The original community script that informed the workflow can be found at [wikiti's Fab Megascans gist](https://gist.github.com/wikiti/f64aa14ee65fd194467d8c8944ed8372).

## License

No open-source license has been selected yet. Repository owners should decide on a license and review the original script's licensing/attribution requirements before distributing derivative code.
