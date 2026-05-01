const axios = require("axios");

const MS_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const XBL_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_AUTH_URL = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";
const MC_ENTITLEMENTS_URL = "https://api.minecraftservices.com/entitlements/mcstore";

/**
 * Build the Microsoft OAuth authorization URL.
 */
function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.MS_REDIRECT_URI,
    scope: "XboxLive.signin offline_access",
    state,
    prompt: "select_account",
  });
  return `${MS_AUTH_URL}/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for a Microsoft access token.
 */
async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    code,
    redirect_uri: process.env.MS_REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await axios.post(`${MS_AUTH_URL}/token`, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data.access_token;
}

/**
 * Exchange a Microsoft access token for an XBL token.
 */
async function getXBLToken(msAccessToken) {
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
    { headers: { "Content-Type": "application/json", Accept: "application/json" } }
  );
  return {
    token: res.data.Token,
    userHash: res.data.DisplayClaims.xui[0].uhs,
  };
}

/**
 * Exchange an XBL token for an XSTS token.
 */
async function getXSTSToken(xblToken) {
  const res = await axios.post(
    XSTS_URL,
    {
      Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    },
    { headers: { "Content-Type": "application/json", Accept: "application/json" } }
  );
  return {
    token: res.data.Token,
    userHash: res.data.DisplayClaims.xui[0].uhs,
    xuid: res.data.DisplayClaims.xui[0].xid || null,
  };
}

/**
 * Exchange XSTS token for a Minecraft access token.
 */
async function getMinecraftToken(xstsToken, userHash) {
  const res = await axios.post(
    MC_AUTH_URL,
    { identityToken: `XBL3.0 x=${userHash};${xstsToken}` },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data.access_token;
}

/**
 * Check if the authenticated account owns Minecraft Java Edition.
 */
async function checkJavaOwnership(mcToken) {
  try {
    const res = await axios.get(MC_ENTITLEMENTS_URL, {
      headers: { Authorization: `Bearer ${mcToken}` },
    });
    const items = res.data.items || [];
    return items.some(
      (i) => i.name === "product_minecraft" || i.name === "game_minecraft"
    );
  } catch {
    return false;
  }
}

/**
 * Fetch the Minecraft Java profile (username + UUID).
 * Returns null if the account doesn't own Java.
 */
async function getJavaProfile(mcToken) {
  try {
    const res = await axios.get(MC_PROFILE_URL, {
      headers: { Authorization: `Bearer ${mcToken}` },
    });
    return { name: res.data.name, uuid: res.data.id };
  } catch {
    return null;
  }
}

/**
 * Full auth flow: code → Microsoft token → XBL → XSTS → Minecraft token → profile.
 *
 * Returns an object describing what accounts were found:
 * {
 *   java: { name, uuid } | null,
 *   bedrock: { name, uuid, xuid } | null,
 *   xuid: string | null
 * }
 */
async function performFullAuth(code) {
  const msToken = await exchangeCodeForToken(code);
  const xbl = await getXBLToken(msToken);
  const xsts = await getXSTSToken(xbl.token);
  const mcToken = await getMinecraftToken(xsts.token, xsts.userHash);

  const javaProfile = await getJavaProfile(mcToken);
  const xuid = xsts.xuid;

  // Bedrock players use their Xbox Gamertag + XUID.
  // GeyserMC whitelists Bedrock players with a "." prefix and their XUID as uuid.
  let bedrockEntry = null;
  if (xuid) {
    try {
      // Fetch Xbox Gamertag from Xbox profile API
      const xboxRes = await axios.get(
        `https://profile.xboxlive.com/users/xuid(${xuid})/settings`,
        {
          params: { settings: "Gamertag" },
          headers: {
            Authorization: `XBL3.0 x=${xsts.userHash};${xsts.token}`,
            "x-xbl-contract-version": "3",
            Accept: "application/json",
          },
        }
      );
      const settings = xboxRes.data?.profileUsers?.[0]?.settings || [];
      const gamertagSetting = settings.find((s) => s.id === "Gamertag");
      const gamertag = gamertagSetting?.value || null;

      if (gamertag) {
        bedrockEntry = {
          name: `.${gamertag}`,          // GeyserMC Bedrock prefix
          uuid: `00000000-0000-0000-${xuid.padStart(16, "0").slice(0, 4)}-${xuid.padStart(16, "0").slice(4)}`,
          xuid,
          gamertag,
        };
      }
    } catch {
      // Xbox profile fetch failed – Bedrock won't be added, Java still works
    }
  }

  return { java: javaProfile, bedrock: bedrockEntry, xuid };
}

module.exports = { buildAuthUrl, performFullAuth };
