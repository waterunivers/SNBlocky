const axios = require("axios");

// ── Endpoints ─────────────────────────────────────────────────────────────────
const MS_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const XBL_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_AUTH_URL =
  "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";

/**
 * Build the Microsoft OAuth authorization URL.
 * We request the "openid" + "offline_access" scopes via standard OIDC,
 * and include XboxLive.signin as an additional scope.
 * The RpsTicket prefix must match the token type returned — "d=" for v2 tokens.
 */
function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.MS_REDIRECT_URI,
    scope: "XboxLive.signin offline_access",
    response_mode: "query",
    state,
    prompt: "select_account",
  });
  return `${MS_AUTH_URL}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code → Microsoft access token.
 */
async function exchangeCodeForToken(code) {
  try {
    console.log("[MSAuth] Exchanging code for Microsoft token...");
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      code,
      redirect_uri: process.env.MS_REDIRECT_URI,
      grant_type: "authorization_code",
      scope: "XboxLive.signin offline_access",
    });

    const res = await axios.post(`${MS_AUTH_URL}/token`, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log("[MSAuth] ✅ Microsoft token obtained");
    return res.data.access_token;
  } catch (err) {
    console.error("[MSAuth] Code exchange failed:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * Microsoft access token → XBL token.
 * IMPORTANT: "d=" prefix is required for tokens from the v2 endpoint.
 */
async function getXBLToken(msAccessToken) {
  try {
    console.log("[MSAuth] Getting XBL token...");
    const res = await axios.post(
      XBL_URL,
      {
        Properties: {
          AuthMethod: "RPS",
          SiteName: "user.auth.xboxlive.com",
          RpsTicket: `d=${msAccessToken}`,
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    console.log("[MSAuth] ✅ XBL token obtained");
    return {
      token: res.data.Token,
      userHash: res.data.DisplayClaims.xui[0].uhs,
    };
  } catch (err) {
    console.error("[MSAuth] XBL token request failed:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * XBL token → XSTS token (scoped to Minecraft services).
 */
async function getXSTSToken(xblToken) {
  try {
    console.log("[MSAuth] Getting XSTS token...");
    const res = await axios.post(
      XSTS_URL,
      {
        Properties: {
          SandboxId: "RETAIL",
          UserTokens: [xblToken],
        },
        RelyingParty: "rp://api.minecraftservices.com/",
        TokenType: "JWT",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    console.log("[MSAuth] ✅ XSTS token obtained");
    return {
      token: res.data.Token,
      userHash: res.data.DisplayClaims.xui[0].uhs,
      xuid: res.data.DisplayClaims.xui[0].xid || null,
    };
  } catch (err) {
    console.error("[MSAuth] XSTS token request failed:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * XSTS token → Minecraft access token.
 */
async function getMinecraftToken(xstsToken, userHash) {
  try {
    console.log("[MSAuth] Getting Minecraft token...");
    const res = await axios.post(
      MC_AUTH_URL,
      { identityToken: `XBL3.0 x=${userHash};${xstsToken}` },
      { headers: { "Content-Type": "application/json" } },
    );
    console.log("[MSAuth] ✅ Minecraft token obtained");
    return res.data.access_token;
  } catch (err) {
    console.error("[MSAuth] Minecraft token request failed:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * Minecraft token → Java profile { name, uuid } or null if no Java licence.
 */
async function getJavaProfile(mcToken) {
  try {
    console.log("[MSAuth] Fetching Java profile...");
    const res = await axios.get(MC_PROFILE_URL, {
      headers: { Authorization: `Bearer ${mcToken}` },
    });
    console.log(`[MSAuth] ✅ Java profile found: ${res.data.name}`);
    return { name: res.data.name, uuid: res.data.id };
  } catch (err) {
    // 404 = no Java profile on this account
    if (err.response?.status === 404) {
      console.log("[MSAuth] No Java profile on this account");
      return null;
    }
    console.error("[MSAuth] Java profile fetch failed:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * XSTS token → Xbox Gamertag (for Bedrock/GeyserMC entry).
 */
async function getGamertag(xuid, xblToken) {
  try {
    // Get a separate XSTS token scoped to Xbox profile API
    const xstsRes = await axios.post(
      XSTS_URL,
      {
        Properties: {
          SandboxId: "RETAIL",
          UserTokens: [xblToken],
        },
        RelyingParty: "http://xboxlive.com",
        TokenType: "JWT",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );

    const xstsToken = xstsRes.data.Token;
    const userHash = xstsRes.data.DisplayClaims.xui[0].uhs;
    const fetchedXuid = xstsRes.data.DisplayClaims.xui[0].xid;

    const res = await axios.get(
      `https://profile.xboxlive.com/users/xuid(${fetchedXuid || xuid})/settings`,
      {
        params: { settings: "Gamertag" },
        headers: {
          Authorization: `XBL3.0 x=${userHash};${xstsToken}`,
          "x-xbl-contract-version": "3",
          Accept: "application/json",
        },
      },
    );

    const settings = res.data?.profileUsers?.[0]?.settings || [];
    const entry = settings.find((s) => s.id === "Gamertag");
    return { gamertag: entry?.value || null, xuid: fetchedXuid || xuid };
  } catch (err) {
    console.error(
      "[DEBUG] Gamertag fetch failed:",
      err.response?.data || err.message,
    );
    return { gamertag: null, xuid };
  }
}

/**
 * Full auth flow: code → profile(s).
 *
 * Returns: { java: {name, uuid}|null, bedrock: {name, uuid, xuid, gamertag}|null }
 */
async function performFullAuth(code) {
  try {
    console.log("[MSAuth] Starting full authentication flow...");
    
    // Step 1 – Microsoft token
    const msToken = await exchangeCodeForToken(code);

    // Step 2 – XBL
    const xbl = await getXBLToken(msToken);

    // Step 3a – XSTS scoped to Xbox (to get XUID + Gamertag)
    console.log("[MSAuth] Getting Xbox XSTS token...");
    const xstsXbox = await axios.post(
      XSTS_URL,
      {
        Properties: { SandboxId: "RETAIL", UserTokens: [xbl.token] },
        RelyingParty: "http://xboxlive.com",
        TokenType: "JWT",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );
    const xuid = xstsXbox.data.DisplayClaims.xui[0].xid || null;
    const userHash = xstsXbox.data.DisplayClaims.xui[0].uhs;
    const xboxToken = xstsXbox.data.Token;
    console.log(`[MSAuth] Xbox XSTS obtained, XUID: ${xuid || "N/A"}`);

    // Step 3b – XSTS scoped to Minecraft services
    const xsts = await getXSTSToken(xbl.token);

    // Step 4 – Minecraft token
    const mcToken = await getMinecraftToken(xsts.token, xsts.userHash);

    // Step 5 – Java profile
    const javaProfile = await getJavaProfile(mcToken);

    // Step 6 – Bedrock / GeyserMC entry via Xbox Gamertag
    let bedrockEntry = null;

    if (xuid) {
      try {
        console.log(`[MSAuth] Fetching Bedrock gamertag for XUID ${xuid}...`);
        const profileRes = await axios.get(
          `https://profile.xboxlive.com/users/xuid(${xuid})/settings`,
          {
            params: { settings: "Gamertag" },
            headers: {
              Authorization: `XBL3.0 x=${userHash};${xboxToken}`,
              "x-xbl-contract-version": "3",
              Accept: "application/json",
            },
          },
        );
        const settings = profileRes.data?.profileUsers?.[0]?.settings || [];
        const gamertag = settings.find((s) => s.id === "Gamertag")?.value || null;
        console.log(`[MSAuth] Gamertag: ${gamertag || "N/A"}`);

        if (gamertag) {
          const xuidHex = BigInt(xuid).toString(16).padStart(16, "0");
          bedrockEntry = {
            name: `.${gamertag}`,
            uuid: `00000000-0000-0000-${xuidHex.slice(0, 4)}-${xuidHex.slice(4)}`,
            xuid,
            gamertag,
          };
          console.log(`[MSAuth] ✅ Bedrock entry created: .${gamertag}`);
        }
      } catch (err) {
        console.error("[MSAuth] Gamertag fetch failed:", err.response?.data || err.message);
      }
    }

    console.log("[MSAuth] ✅ Full auth complete");
    return { java: javaProfile, bedrock: bedrockEntry };
  } catch (err) {
    console.error("[MSAuth] Full auth flow failed:", err.message);
    throw err;
  }
}

module.exports = { buildAuthUrl, performFullAuth };
