var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-q9IIBO/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// index.js
var META_API_VERSION = "v19.0";
var META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
var META_DIALOG_REDIRECT_PATH = "/oauth/meta/callback";
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === META_DIALOG_REDIRECT_PATH) {
      return handleOAuthCallback(request, env);
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduledPoster(env));
  }
};
async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return redirectToPortal(env, { meta_error: "no_code" });
  }
  if (!state) {
    return redirectToPortal(env, { meta_error: "missing_client_state" });
  }
  try {
    const shortLivedToken = await exchangeCodeForToken(env, code);
    const longLivedUserToken = await exchangeForLongLivedUserToken(env, shortLivedToken.access_token);
    const tokenExpiresAt = new Date(Date.now() + (longLivedUserToken.expires_in || 0) * 1e3).toISOString();
    const pages = await getUserPages(longLivedUserToken.access_token);
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("No Facebook pages were found for this account.");
    }
    await updateMetaConnectionsForClient(env, state, pages, tokenExpiresAt);
    return redirectToPortal(env, { meta_connected: "true" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return redirectToPortal(env, { meta_error: message });
  }
}
__name(handleOAuthCallback, "handleOAuthCallback");
async function runScheduledPoster(env) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const posts = await querySupabase(env, "/rest/v1/scheduled_posts", {
    select: [
      "id",
      "user_id",
      "platform",
      "caption",
      "image_url",
      "status",
      "scheduled_at",
      "auto_post_enabled",
      "posted_to_facebook",
      "posted_to_instagram",
      "post_type"
    ].join(","),
    status: "eq.scheduled",
    auto_post_enabled: "eq.true",
    scheduled_at: `lte.${nowIso}`,
    platform: "in.(facebook,instagram)",
    or: "(posted_to_facebook.eq.false,posted_to_instagram.eq.false)",
    order: "scheduled_at.asc",
    limit: "100"
  });
  console.log("Found posts to process:", posts?.length ?? 0);
  if (!Array.isArray(posts) || posts.length === 0) {
    return;
  }
  for (const post of posts) {
    console.log("Processing post ID:", post.id, "| User ID:", post.user_id, "| Platform:", post.platform);
    await publishPost(env, post);
  }
}
__name(runScheduledPoster, "runScheduledPoster");
async function publishPost(env, post) {
  const needsFacebook = !post.posted_to_facebook;
  const needsInstagram = !post.posted_to_instagram;
  const connection = await getActiveMetaConnection(env, post.user_id);
  console.log("Meta connection found for post", post.id, ":", connection ? `Yes (ID: ${connection.id})` : "No");
  if (!connection) {
    if (needsFacebook) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: "facebook",
        status: "skipped",
        error_message: "No active Meta connection found for this client."
      });
    }
    if (needsInstagram) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: "instagram",
        status: "skipped",
        error_message: "No active Meta connection found for this client."
      });
    }
    return;
  }
  let activeConnection = connection;
  if (activeConnection.token_expires_at) {
    const expiresAt = new Date(activeConnection.token_expires_at);
    const msUntilExpiry = expiresAt.getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      if (needsFacebook) {
        await insertPostLog(env, {
          post_id: post.id,
          client_id: post.user_id,
          platform: "facebook",
          status: "failed",
          error_message: "Meta access token is expired. Reconnect this client account."
        });
      }
      if (needsInstagram) {
        await insertPostLog(env, {
          post_id: post.id,
          client_id: post.user_id,
          platform: "instagram",
          status: "failed",
          error_message: "Meta access token is expired. Reconnect this client account."
        });
      }
      await updateScheduledPost(env, post.id, {
        post_error: "Meta access token is expired. Reconnect this client account."
      });
      return;
    }
    if (msUntilExpiry <= 7 * 24 * 60 * 60 * 1e3) {
      activeConnection = await tryRefreshConnectionToken(env, activeConnection, post);
    }
  }
  if (needsFacebook) {
    await publishToFacebook(env, post, activeConnection);
  }
  if (needsInstagram) {
    if (!activeConnection.instagram_account_id) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: "instagram",
        status: "skipped",
        error_message: "Client has no connected Instagram Business account."
      });
      return;
    }
    if (!post.image_url) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: "instagram",
        status: "skipped",
        error_message: "Instagram API requires an image or video URL."
      });
      await updateScheduledPost(env, post.id, {
        post_error: "Instagram API requires an image or video URL."
      });
      return;
    }
    await publishToInstagram(env, post, activeConnection);
  }
}
__name(publishPost, "publishPost");
async function publishToFacebook(env, post, connection) {
  const withinLimit = await checkDailyPostLimit(env, post.user_id, "facebook");
  if (!withinLimit) {
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: "facebook",
      status: "skipped",
      error_message: "Daily Facebook posting cap reached for this client page."
    });
    return;
  }
  try {
    const isVideo = post.post_type === "video";
    const endpoint = isVideo ? `${META_GRAPH_BASE}/${connection.facebook_page_id}/videos` : post.image_url ? `${META_GRAPH_BASE}/${connection.facebook_page_id}/photos` : `${META_GRAPH_BASE}/${connection.facebook_page_id}/feed`;
    const payload = new URLSearchParams();
    payload.set("access_token", connection.page_access_token);
    if (isVideo) {
      payload.set("description", post.caption || "");
      payload.set("file_url", post.image_url || "");
    } else if (post.image_url) {
      payload.set("caption", post.caption || "");
      payload.set("url", post.image_url);
    } else {
      payload.set("message", post.caption || "");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload
    });
    const result = await response.json();
    console.log("Facebook API response for post", post.id, "| Status:", response.status, "| Result:", JSON.stringify(result));
    if (!response.ok || result.error) {
      throw new Error(result.error?.message || "Facebook post failed.");
    }
    await updateScheduledPost(env, post.id, {
      posted_to_facebook: true,
      facebook_post_id: result.id || result.post_id || null,
      post_error: null,
      posted_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: "facebook",
      status: "success",
      error_message: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook post failed.";
    console.error("Error publishing to Facebook for post", post.id, ":", message);
    await updateScheduledPost(env, post.id, { post_error: message });
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: "facebook",
      status: "failed",
      error_message: message
    });
  }
}
__name(publishToFacebook, "publishToFacebook");
async function publishToInstagram(env, post, connection) {
  const withinLimit = await checkDailyPostLimit(env, post.user_id, "instagram");
  if (!withinLimit) {
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: "instagram",
      status: "skipped",
      error_message: "Daily Instagram posting cap reached for this client page."
    });
    return;
  }
  try {
    const isVideo = post.post_type === "video";
    const containerPayload = new URLSearchParams();
    containerPayload.set("access_token", connection.page_access_token);
    containerPayload.set("caption", post.caption || "");
    if (isVideo) {
      containerPayload.set("media_type", "REELS");
      containerPayload.set("video_url", post.image_url);
    } else {
      containerPayload.set("image_url", post.image_url);
    }
    const containerRes = await fetch(`${META_GRAPH_BASE}/${connection.instagram_account_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: containerPayload
    });
    const containerData = await containerRes.json();
    console.log("Instagram media container API response for post", post.id, "| Status:", containerRes.status, "| Result:", JSON.stringify(containerData));
    if (!containerRes.ok || containerData.error) {
      throw new Error(containerData.error?.message || "Instagram media container failed.");
    }
    const publishPayload = new URLSearchParams();
    publishPayload.set("access_token", connection.page_access_token);
    publishPayload.set("creation_id", containerData.id);
    const publishRes = await fetch(`${META_GRAPH_BASE}/${connection.instagram_account_id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishPayload
    });
    const publishData = await publishRes.json();
    console.log("Instagram media publish API response for post", post.id, "| Status:", publishRes.status, "| Result:", JSON.stringify(publishData));
    if (!publishRes.ok || publishData.error) {
      throw new Error(publishData.error?.message || "Instagram publish failed.");
    }
    await updateScheduledPost(env, post.id, {
      posted_to_instagram: true,
      instagram_post_id: publishData.id || null,
      post_error: null,
      posted_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: "instagram",
      status: "success",
      error_message: null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram post failed.";
    console.error("Error publishing to Instagram for post", post.id, ":", message);
    await updateScheduledPost(env, post.id, { post_error: message });
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: "instagram",
      status: "failed",
      error_message: message
    });
  }
}
__name(publishToInstagram, "publishToInstagram");
async function checkDailyPostLimit(env, clientId, platform) {
  const start = /* @__PURE__ */ new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const rows = await querySupabase(env, "/rest/v1/post_logs", {
    select: "id",
    client_id: `eq.${clientId}`,
    platform: `eq.${platform}`,
    status: "eq.success",
    attempted_at: `gte.${start.toISOString()}`,
    and: `(attempted_at.lt.${end.toISOString()})`,
    limit: "201"
  });
  return Array.isArray(rows) && rows.length < 200;
}
__name(checkDailyPostLimit, "checkDailyPostLimit");
async function tryRefreshConnectionToken(env, connection, post) {
  try {
    const refreshed = await exchangeForLongLivedUserToken(env, connection.page_access_token);
    if (!refreshed?.access_token) {
      return connection;
    }
    const tokenExpiresAt = new Date(Date.now() + (refreshed.expires_in || 0) * 1e3).toISOString();
    const updated = {
      page_access_token: refreshed.access_token,
      token_expires_at: tokenExpiresAt,
      connected_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await updateSupabase(env, `/rest/v1/meta_connections?id=eq.${connection.id}`, updated);
    return {
      ...connection,
      ...updated
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Token refresh failed";
    console.error("Error refreshing Meta token for post", post.id, ":", errorMessage);
    if (!post.posted_to_facebook) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: "facebook",
        status: "skipped",
        error_message: "Meta token is close to expiry and automatic refresh failed."
      });
    }
    if (!post.posted_to_instagram) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: "instagram",
        status: "skipped",
        error_message: "Meta token is close to expiry and automatic refresh failed."
      });
    }
    return connection;
  }
}
__name(tryRefreshConnectionToken, "tryRefreshConnectionToken");
async function getActiveMetaConnection(env, clientId) {
  const rows = await querySupabase(env, "/rest/v1/meta_connections", {
    select: "*",
    client_id: `eq.${clientId}`,
    is_active: "eq.true",
    order: "connected_at.desc",
    limit: "1"
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
__name(getActiveMetaConnection, "getActiveMetaConnection");
async function updateMetaConnectionsForClient(env, clientId, pages, tokenExpiresAt) {
  await updateSupabase(env, `/rest/v1/meta_connections?client_id=eq.${encodeURIComponent(clientId)}`, {
    is_active: false
  });
  for (const page of pages) {
    await saveMetaConnection(env, {
      client_id: clientId,
      facebook_page_id: page.id,
      facebook_page_name: page.name || null,
      instagram_account_id: page.instagram_business_account?.id || null,
      page_access_token: page.access_token,
      token_expires_at: tokenExpiresAt,
      connected_at: (/* @__PURE__ */ new Date()).toISOString(),
      is_active: true
    });
  }
}
__name(updateMetaConnectionsForClient, "updateMetaConnectionsForClient");
async function saveMetaConnection(env, connection) {
  return insertSupabase(env, "/rest/v1/meta_connections?on_conflict=client_id,facebook_page_id", connection, {
    Prefer: "resolution=merge-duplicates,return=representation"
  });
}
__name(saveMetaConnection, "saveMetaConnection");
async function updateScheduledPost(env, postId, updates) {
  return updateSupabase(env, `/rest/v1/scheduled_posts?id=eq.${postId}`, updates);
}
__name(updateScheduledPost, "updateScheduledPost");
async function insertPostLog(env, logEntry) {
  return insertSupabase(env, "/rest/v1/post_logs", logEntry);
}
__name(insertPostLog, "insertPostLog");
async function getUserPages(accessToken) {
  const url = new URL(`${META_GRAPH_BASE}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || "Failed to load user pages.");
  }
  return json.data || [];
}
__name(getUserPages, "getUserPages");
async function exchangeCodeForToken(env, code) {
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("client_secret", env.META_APP_SECRET);
  url.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
  url.searchParams.set("code", code);
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || "Unable to exchange authorization code.");
  }
  return json;
}
__name(exchangeCodeForToken, "exchangeCodeForToken");
async function exchangeForLongLivedUserToken(env, token) {
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("client_secret", env.META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", token);
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || "Unable to exchange long-lived token.");
  }
  return json;
}
__name(exchangeForLongLivedUserToken, "exchangeForLongLivedUserToken");
function redirectToPortal(env, params) {
  const target = new URL(env.PORTAL_URL);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, String(value));
  }
  return Response.redirect(target.toString(), 302);
}
__name(redirectToPortal, "redirectToPortal");
async function querySupabase(env, path, query) {
  const url = new URL(path, env.SUPABASE_URL);
  for (const [key, value] of Object.entries(query || {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`
    }
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || `Supabase query failed: ${response.status}`);
  }
  return json;
}
__name(querySupabase, "querySupabase");
async function insertSupabase(env, path, payload, extraHeaders = {}) {
  return writeSupabase(env, path, "POST", payload, extraHeaders);
}
__name(insertSupabase, "insertSupabase");
async function updateSupabase(env, path, payload) {
  return writeSupabase(env, path, "PATCH", payload);
}
__name(updateSupabase, "updateSupabase");
async function writeSupabase(env, path, method, payload, extraHeaders = {}) {
  const response = await fetch(new URL(path, env.SUPABASE_URL), {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal",
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase write failed: ${response.status} ${text}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return null;
}
__name(writeSupabase, "writeSupabase");

// ../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-q9IIBO/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-q9IIBO/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
