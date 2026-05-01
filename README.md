# 🧱 SNBlocky — Crossroads SMP Discord Bot

SNBlocky is a Discord bot for **Crossroads SMP** that handles Minecraft whitelisting
via secure Microsoft OAuth login, and provides players with server info, downloads,
and rules — all from a single Discord embed.

---

## ✨ Features

- `/blocky info` — Owner-only command that posts a live server info embed with action buttons
- **🔑 Join Whitelist** — Sends the player a secure Microsoft login link; automatically whitelists their Java and/or Bedrock (GeyserMC) accounts
- **📦 Downloads** — Ephemeral message with links to modpacks from your `/assets/packs` folder + recommended websites
- **📋 Rules & Info** — Ephemeral message with server rules (easily editable in code)
- Extensible `/blocky` command structure — add new subcommands easily

---

## 📁 Project Structure

```
SNBlocky/
├── src/
│   ├── index.js                  ← Entry point
│   ├── register-commands.js      ← Run once to register slash commands
│   ├── commands/
│   │   └── blocky.js             ← /blocky info command
│   ├── handlers/
│   │   ├── interactionHandler.js ← Routes interactions to the right handler
│   │   └── buttons/
│   │       ├── whitelistButton.js  ← Generates OAuth login link
│   │       ├── downloadsButton.js  ← Shows download links (edit this!)
│   │       └── rulesButton.js      ← Shows server rules (edit this!)
│   ├── utils/
│   │   ├── minecraft.js          ← Whitelist read/write, server status
│   │   ├── msAuth.js             ← Full Microsoft → Xbox → Minecraft OAuth flow
│   │   └── sessions.js           ← In-memory OAuth state token management
│   └── web/
│       └── oauthServer.js        ← Express server for OAuth callback + file downloads
├── assets/
│   └── packs/                    ← ⬅ DROP YOUR MODPACK FILES HERE
├── .env.example                  ← Copy to .env and fill in your values
├── package.json
└── README.md
```

---

## 🚀 Setup Guide

### 1. Prerequisites

- **Node.js 18+** — https://nodejs.org
- A **Discord Application** with a Bot — https://discord.com/developers/applications
- A **Microsoft Azure App Registration** (free) — https://portal.azure.com
- Your Minecraft server running with a readable `whitelist.json`
- A publicly reachable port for OAuth (see step 5)

---

### 2. Install Dependencies

```bash
cd SNBlocky
npm install
```

---

### 3. Configure .env

```bash
cp .env.example .env
```

Open `.env` and fill in all values:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your bot's token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Your Discord application's Client ID |
| `DISCORD_GUILD_ID` | The ID of your Discord server |
| `MS_CLIENT_ID` | Azure app registration Client ID |
| `MS_CLIENT_SECRET` | Azure app registration Client Secret |
| `MS_REDIRECT_URI` | Public URL of your OAuth callback (see step 5) |
| `OAUTH_PORT` | Port for the Express server (default: 3000) |
| `MC_SERVER_HOST` | Hostname for pinging your MC server (usually `localhost`) |
| `MC_SERVER_PORT` | Minecraft server port (default: `25565`) |
| `MC_SERVER_IP_DISPLAY` | The IP shown to players in the embed |
| `WHITELIST_PATH` | Absolute path to your `whitelist.json` |
| `SERVER_NAME` | Display name shown in the embed |
| `SERVER_VERSION` | Minecraft version (fallback if ping fails) |
| `SERVER_ABOUT` | Short description shown in the embed |
| `SERVER_COVER_IMAGE` | URL of the cover image for the embed |
| `OWNER_ID` | Your Discord User ID (right-click yourself → Copy ID) |

---

### 4. Create the Azure App Registration

1. Go to https://portal.azure.com → **Azure Active Directory** → **App registrations** → **New registration**
2. Name it anything (e.g. "SNBlocky")
3. Set **Supported account types** to: *Personal Microsoft accounts only*
4. Under **Redirect URI**, select **Web** and enter your callback URL:
   `http://YOUR_IP_OR_DOMAIN:3000/auth/callback`
5. After creating, note the **Application (client) ID** → paste as `MS_CLIENT_ID`
6. Go to **Certificates & secrets** → **New client secret** → copy the value → paste as `MS_CLIENT_SECRET`
7. Go to **API permissions** → **Add permission** → **Microsoft Graph** → **Delegated** → add `XboxLive.signin`

---

### 5. Making the OAuth Callback Public

The bot's Express server must be reachable from the internet so Microsoft can redirect
users back to it after login. Options:

**Option A — Port Forwarding (home server)**
Forward port `3000` (or your `OAUTH_PORT`) on your router to the machine running the bot.
Set `MS_REDIRECT_URI=http://YOUR_PUBLIC_IP:3000/auth/callback`

**Option B — ngrok (easy testing)**
```bash
npx ngrok http 3000
```
Copy the `https://xxxx.ngrok.io` URL → set `MS_REDIRECT_URI=https://xxxx.ngrok.io/auth/callback`
Also update the redirect URI in your Azure app registration to match.

**Option C — VPS with domain**
Set up a reverse proxy (nginx/Caddy) and use your domain.
`MS_REDIRECT_URI=https://auth.yourdomain.com/auth/callback`

---

### 6. Register Slash Commands

Run this **once** (or whenever you add new commands):

```bash
npm run register
```

---

### 7. Start the Bot

```bash
npm start
```

You should see:
```
✅ SNBlocky is online as SNBlocky#1234
   OAuth callback: http://localhost:3000/auth/callback
[OAuth] Callback server listening on port 3000
```

---

## 🗂️ Adding Modpack Files

Drop any files into `assets/packs/`:

```
assets/
└── packs/
    ├── CrossroadsSMP-Modpack-v1.2.mrpack
    ├── Community-PvP-Pack.zip
    └── ...
```

They will **automatically appear** in the Downloads message — no code changes needed.
The bot serves them directly from the Express server at `/downloads/filename`.

---

## ✏️ Customising Content

**Server rules** → Edit `src/handlers/buttons/rulesButton.js`
`RULES_CONTENT` is a plain Markdown string — edit freely.

**Downloads message** → Edit `src/handlers/buttons/downloadsButton.js`
- `INTRO_TEXT` — the intro paragraph
- `RECOMMENDED_SITES` — array of `{ label, url }` objects for external links

**Embed info** → Controlled via `.env` variables (`SERVER_NAME`, `SERVER_ABOUT`, `SERVER_COVER_IMAGE`)

---

## ➕ Adding New /blocky Subcommands

1. Open `src/commands/blocky.js`
2. Add a new `.addSubcommand(...)` chain to the builder
3. Add a new `if (sub === "your-subcommand")` block in `execute()`
4. Run `npm run register` to push the updated command to Discord

---

## 🔄 Whitelist & Minecraft Integration

After a player authenticates:
- Their Java UUID + username are written to `whitelist.json`
- Their Bedrock/Xbox entry (`.Gamertag` + XUID-derived UUID) is also written if detected
- Run `/whitelist reload` in your Minecraft server console to apply changes immediately
  (or add RCON support later — the file is ready to go)

---

## 🛟 Troubleshooting

| Problem | Fix |
|---|---|
| "Session expired" after login | Your `OAUTH_PORT` isn't publicly reachable. Check port forwarding / ngrok. |
| "No Minecraft account found" | The Microsoft account doesn't have a Minecraft licence. |
| Bot offline | Check `DISCORD_TOKEN` in `.env` |
| `/blocky info` says "no permission" | Check `OWNER_ID` matches your Discord user ID exactly |
| Whitelist not updating | Check `WHITELIST_PATH` is correct and the bot process has write permission |

---

*Built with ❤️ for Crossroads SMP — powered by SNBlocky*
