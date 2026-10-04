# LLM Chess

Browser-only chess app (React + Vite). Each side is a **human** or an AI model
from **Claude** (Anthropic), **ChatGPT** (OpenAI) or **Grok** (xAI).

- **Your own account:** each user connects their own API keys, so AI moves use
  that user's account, limits and billing. There is no server: keys stay in
  the browser and go only to that company's API.
- **Live model lists:** the White and Black lists show every model the user's
  key can use, loaded live from each company.
- **Rules:** full chess rules ([chess.js](https://github.com/jhlywa/chess.js)),
  with drag-and-drop or click-to-move and a promotion picker.
- **Cost tracking:** an estimated cost for every AI move, the total so far,
  totals per side, and a game-over summary with a breakdown per model.
- **Pause and resume:** stop an AI vs AI game at any time.

## Why API keys and not "Sign in with …"
None of the three companies offers a sign-in for third-party apps that pays
for API use from the user's account. Anthropic does not allow Claude
subscription sign-in in third-party apps. OpenAI's "Sign in with ChatGPT" is
only for partner apps. xAI has no public sign-in program for third-party apps.
So each user pastes an API key from their own developer console.

## Run locally
```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # static site in dist/
```

## Host it
`npm run build` makes a static site in `dist/`. Any static host works, with no
server and no secrets:

| Host | How |
|---|---|
| Netlify / Cloudflare Pages / Vercel | Connect the repo, set the base directory to `chess-app`, build command `npm run build`, output directory `dist` |
| GitHub Pages | Build, then publish the `dist/` folder (for example with the `actions/deploy-pages` action) |
| Anything else | Upload the contents of `dist/` |

The build uses relative paths, so it also works from a sub-folder.

## Browser access (CORS)
The browser calls the APIs directly. Anthropic allows this, and the app sends
the required header. If a company's API refuses calls from a browser, the
app shows "the browser could not reach the API (network or CORS)". Then set
a **proxy URL** for that company under *API keys → Advanced*. The app sends
the same requests to that URL instead.

## Prices
Costs are estimates: the token counts that each API returns × the list
prices in `src/pricing.ts`. Edit that table when prices change; a model that
is not in it shows "n/a", and totals become "≥". Each company's console has
the billed amount.

## Code
| File | What it does |
|---|---|
| `src/App.tsx` | Game state, AI turn loop, board |
| `src/llm.ts` | Prompt, move parsing, 3 retries for illegal replies |
| `src/providers/` | `claude.ts` (Anthropic SDK); `openaiCompat.ts` (ChatGPT and Grok via the Responses API) |
| `src/pricing.ts` | Price table |
| `src/keys.ts` | Key storage (memory, or localStorage with "Remember") |
| `src/components/` | Dialogs and panels |

To add a company with an OpenAI-compatible API, add one `makeProvider({...})`
call in `src/providers/openaiCompat.ts` and register it in
`src/providers/index.ts`.
