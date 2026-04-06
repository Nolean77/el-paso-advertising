const META_API_VERSION = 'v19.0'
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`
const META_DIALOG_REDIRECT_PATH = '/oauth/meta/callback'
const METRICS_LIST_PATH = '/metrics'
const METRICS_SYNC_PATH = '/metrics/sync'
const BLOCKED_FACEBOOK_PAGE_IDS = new Set(['433627129826098'])
const REQUIRED_META_SCOPES = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'read_insights']
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
])
const MESSAGE = {
  tokenReconnectRequired: 'Meta access token is expired. Reconnect this client account.',
  tokenRefreshFailed: 'Meta token refresh failed. Reconnect this client account.',
  noActiveConnection: 'No active Meta connection found for this client.',
  noInstagramAccount: 'No connected Instagram Business account for this client.',
  instagramMediaRequired: 'Instagram requires an image or video URL.',
  facebookDailyCap: 'Daily Facebook posting cap reached for this client page.',
  instagramDailyCap: 'Daily Instagram posting cap reached for this client page.',
  readInsightsReconnectRequired: 'Meta account is missing the insights permission. Reconnect this client account and try again.',
  facebookMetricsPermissionRequired: 'Facebook metrics access is not fully granted. In Meta Developers, enable Advanced Access/App Review for pages_read_engagement and read_insights (or use an app admin/tester while the app is in Development mode), then reconnect this client account.',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const corsHeaders = buildCorsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method === 'GET' && url.pathname === META_DIALOG_REDIRECT_PATH) {
      return handleOAuthCallback(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    if (request.method === 'GET' && url.pathname === METRICS_LIST_PATH) {
      return handleMetricsListRequest(request, env, corsHeaders)
    }

    if (request.method === 'POST' && url.pathname === METRICS_SYNC_PATH) {
      return handleMetricsSyncRequest(request, env, corsHeaders)
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduledWork(env))
  },
}

async function handleOAuthCallback(request, env) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code) {
    return redirectToPortal(env, { meta_error: 'no_code' })
  }

  if (!state) {
    return redirectToPortal(env, { meta_error: 'missing_client_state' })
  }

  try {
    const shortLivedToken = await exchangeCodeForToken(env, code)
    const longLivedUserToken = await exchangeForLongLivedUserToken(env, shortLivedToken.access_token)
      // Validate expires_in: use a default of 5,184,000 seconds (60 days) if missing or invalid
      const expiresInSeconds = typeof longLivedUserToken.expires_in === 'number' && longLivedUserToken.expires_in > 0
        ? longLivedUserToken.expires_in
        : 5184000 // 60 days
      const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

    const grantedScopes = await getGrantedPermissions(longLivedUserToken.access_token)
    const missingScopes = REQUIRED_META_SCOPES.filter((scope) => !grantedScopes.includes(scope))

    if (missingScopes.length > 0) {
      throw new Error(`Meta granted only [${grantedScopes.join(', ') || 'none'}]. Missing required permissions: ${missingScopes.join(', ')}. Please reconnect and approve all requested permissions.`)
    }

    const pages = await getUserPages(longLivedUserToken.access_token)
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error('No Facebook pages were found for this account.')
    }

    await updateMetaConnectionsForClient(env, state, pages, tokenExpiresAt, longLivedUserToken.access_token)

    return redirectToPortal(env, { meta_connected: 'true' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    return redirectToPortal(env, { meta_error: message })
  }
}

async function runScheduledWork(env) {
  await runScheduledPoster(env)
  await syncFacebookMetrics(env)
}

async function runScheduledPoster(env) {
  console.log('runScheduledPoster started')
  try {
    const nowIso = new Date().toISOString()

    const debugUrl = new URL('/rest/v1/scheduled_posts', env.SUPABASE_URL)
    debugUrl.searchParams.set('select', [
      'id',
      'user_id',
      'platform',
      'caption',
      'image_url',
      'status',
      'scheduled_at',
      'auto_post_enabled',
      'posted_to_facebook',
      'posted_to_instagram',
      'post_type',
    ].join(','))
    debugUrl.searchParams.set('status', 'eq.scheduled')
    debugUrl.searchParams.set('auto_post_enabled', 'eq.true')
    debugUrl.searchParams.set('scheduled_at', `lte.${nowIso}`)
    debugUrl.searchParams.set('order', 'scheduled_at.asc')
    debugUrl.searchParams.set('limit', '100')
    console.log('Querying Supabase URL:', debugUrl.toString())

    const posts = await querySupabase(env, '/rest/v1/scheduled_posts', {
      select: [
        'id',
        'user_id',
        'platform',
        'caption',
        'image_url',
        'status',
        'scheduled_at',
        'auto_post_enabled',
        'posted_to_facebook',
        'posted_to_instagram',
        'post_type',
      ].join(','),
      status: 'eq.scheduled',
      auto_post_enabled: 'eq.true',
      scheduled_at: `lte.${nowIso}`,
      order: 'scheduled_at.asc',
      limit: '100',
    })

    console.log('Found posts to process:', posts?.length ?? 0)

    if (!Array.isArray(posts) || posts.length === 0) {
      return
    }

    const filteredPosts = posts.filter((p) => p.platform === 'facebook' || p.platform === 'instagram')
    console.log('Posts after platform filter:', filteredPosts.length)

    for (const post of filteredPosts) {
      console.log('Processing post ID:', post.id, '| User ID:', post.user_id, '| Platform:', post.platform)
      await publishPost(env, post)
    }
  } catch (err) {
    console.error('runScheduledPoster error:', err?.message || err)
  }
}

async function publishPost(env, post) {
  const needsFacebook = !post.posted_to_facebook
  const needsInstagram = !post.posted_to_instagram

  const connection = await getActiveMetaConnection(env, post.user_id)
  console.log(
    'Meta connection found for post',
    post.id,
    ':',
    connection
      ? `Yes (ID: ${connection.id}, Page: ${connection.facebook_page_name || connection.facebook_page_id})`
      : 'No'
  )

  if (!connection) {
    if (needsFacebook) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: 'facebook',
        status: 'skipped',
        error_message: MESSAGE.noActiveConnection,
      })
    }

    if (needsInstagram) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: 'instagram',
        status: 'skipped',
        error_message: MESSAGE.noActiveConnection,
      })
    }

    return
  }

  let activeConnection = connection
  if (activeConnection.token_expires_at) {
    const expiresAt = new Date(activeConnection.token_expires_at)
    const msUntilExpiry = expiresAt.getTime() - Date.now()

    // Attempt refresh if token is expired or expiring soon (7 days)
    if (msUntilExpiry <= 7 * 24 * 60 * 60 * 1000) {
      const refreshed = await tryRefreshConnectionToken(env, activeConnection, post)
      activeConnection = refreshed

      // After refresh attempt, check if token is still expired
      const newExpiresAt = activeConnection.token_expires_at ? new Date(activeConnection.token_expires_at) : null
      const msUntilNewExpiry = newExpiresAt ? newExpiresAt.getTime() - Date.now() : 1

      if (msUntilNewExpiry <= 0) {
        if (needsFacebook) {
          await insertPostLog(env, {
            post_id: post.id,
            client_id: post.user_id,
            platform: 'facebook',
            status: 'failed',
            error_message: MESSAGE.tokenReconnectRequired,
          })
        }

        if (needsInstagram) {
          await insertPostLog(env, {
            post_id: post.id,
            client_id: post.user_id,
            platform: 'instagram',
            status: 'failed',
            error_message: MESSAGE.tokenReconnectRequired,
          })
        }

        await updateScheduledPost(env, post.id, {
          post_error: MESSAGE.tokenReconnectRequired,
        })
        return
      }
    }
  }

  if (needsFacebook) {
    await publishToFacebook(env, post, activeConnection)
  }

  if (needsInstagram) {
    if (!activeConnection.instagram_account_id) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: 'instagram',
        status: 'skipped',
        error_message: MESSAGE.noInstagramAccount,
      })
      return
    }

    if (!post.image_url) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: 'instagram',
        status: 'skipped',
        error_message: MESSAGE.instagramMediaRequired,
      })
      await updateScheduledPost(env, post.id, {
        post_error: MESSAGE.instagramMediaRequired,
      })
      return
    }

    await publishToInstagram(env, post, activeConnection)
  }
}

async function publishToFacebook(env, post, connection) {
  const withinLimit = await checkDailyPostLimit(env, post.user_id, 'facebook')
  if (!withinLimit) {
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: 'facebook',
      status: 'skipped',
      error_message: MESSAGE.facebookDailyCap,
    })
    return
  }

  try {
    const isVideo = post.post_type === 'video'

    if (post.image_url) {
      await assertPublicMediaUrl(post.image_url, `facebook post ${post.id}`)
    }

    const endpoint = isVideo
      ? `${META_GRAPH_BASE}/${connection.facebook_page_id}/videos`
      : post.image_url
        ? `${META_GRAPH_BASE}/${connection.facebook_page_id}/photos`
        : `${META_GRAPH_BASE}/${connection.facebook_page_id}/feed`

    const { pageAccessToken } = parseStoredMetaTokens(connection.page_access_token)
    if (!pageAccessToken) {
      throw new Error(MESSAGE.noActiveConnection)
    }

    const payload = new URLSearchParams()
    payload.set('access_token', pageAccessToken)

    if (isVideo) {
      payload.set('description', post.caption || '')
      payload.set('file_url', post.image_url || '')
    } else if (post.image_url) {
      payload.set('caption', post.caption || '')
      payload.set('url', post.image_url)
    } else {
      payload.set('message', post.caption || '')
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
    })
    const result = await readMetaResponseBody(response)
    console.log('Facebook API response for post', post.id, '| Status:', response.status, '| Result:', JSON.stringify(result))

    if (!response.ok || result.error) {
      throw new Error(result.error?.message || `Facebook post failed (HTTP ${response.status}). ${result.rawText || ''}`.trim())
    }

    await updateScheduledPost(env, post.id, {
      posted_to_facebook: true,
      facebook_post_id: result.post_id || result.id || null,
      post_error: null,
      posted_at: new Date().toISOString(),
    })

    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: 'facebook',
      status: 'success',
      error_message: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Facebook post failed.'
    console.error('Error publishing to Facebook for post', post.id, ':', message)
    await updateScheduledPost(env, post.id, { post_error: message })
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: 'facebook',
      status: 'failed',
      error_message: message,
    })
  }
}

async function publishToInstagram(env, post, connection) {
  const withinLimit = await checkDailyPostLimit(env, post.user_id, 'instagram')
  if (!withinLimit) {
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: 'instagram',
      status: 'skipped',
      error_message: MESSAGE.instagramDailyCap,
    })
    return
  }

  try {
    const isVideo = post.post_type === 'video'

    await assertPublicMediaUrl(post.image_url, `instagram post ${post.id}`)

    const { pageAccessToken } = parseStoredMetaTokens(connection.page_access_token)
    if (!pageAccessToken) {
      throw new Error(MESSAGE.noActiveConnection)
    }

    const containerPayload = new URLSearchParams()
    containerPayload.set('access_token', pageAccessToken)
    containerPayload.set('caption', post.caption || '')

    if (isVideo) {
      containerPayload.set('media_type', 'REELS')
      containerPayload.set('video_url', post.image_url)
    } else {
      containerPayload.set('image_url', post.image_url)
    }

    const containerRes = await fetch(`${META_GRAPH_BASE}/${connection.instagram_account_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: containerPayload,
    })
    const containerData = await readMetaResponseBody(containerRes)
    console.log('Instagram media container API response for post', post.id, '| Status:', containerRes.status, '| Result:', JSON.stringify(containerData))

    if (!containerRes.ok || containerData.error) {
      throw new Error(containerData.error?.message || `Instagram media container failed (HTTP ${containerRes.status}). ${containerData.rawText || ''}`.trim())
    }

    const publishPayload = new URLSearchParams()
    publishPayload.set('access_token', pageAccessToken)
    publishPayload.set('creation_id', containerData.id)

    const publishRes = await fetch(`${META_GRAPH_BASE}/${connection.instagram_account_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishPayload,
    })
    const publishData = await readMetaResponseBody(publishRes)
    console.log('Instagram media publish API response for post', post.id, '| Status:', publishRes.status, '| Result:', JSON.stringify(publishData))

    if (!publishRes.ok || publishData.error) {
      throw new Error(publishData.error?.message || `Instagram publish failed (HTTP ${publishRes.status}). ${publishData.rawText || ''}`.trim())
    }

    await updateScheduledPost(env, post.id, {
      posted_to_instagram: true,
      instagram_post_id: publishData.id || null,
      post_error: null,
      posted_at: new Date().toISOString(),
    })

    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: 'instagram',
      status: 'success',
      error_message: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram post failed.'
    console.error('Error publishing to Instagram for post', post.id, ':', message)
    await updateScheduledPost(env, post.id, { post_error: message })
    await insertPostLog(env, {
      post_id: post.id,
      client_id: post.user_id,
      platform: 'instagram',
      status: 'failed',
      error_message: message,
    })
  }
}

async function handleMetricsListRequest(request, env, corsHeaders) {
  try {
    const url = new URL(request.url)
    const clientId = typeof url.searchParams.get('clientId') === 'string'
      ? url.searchParams.get('clientId').trim()
      : ''
    const platform = typeof url.searchParams.get('platform') === 'string'
      ? url.searchParams.get('platform').trim().toLowerCase()
      : ''

    if (!clientId) {
      return jsonResponse({ ok: false, error: 'clientId is required.' }, 400, corsHeaders)
    }

    const metrics = await listPerformanceMetrics(env, {
      clientId,
      platform: platform || undefined,
    })

    return jsonResponse({ ok: true, metrics }, 200, corsHeaders)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load performance metrics.'
    console.error('Metrics list request failed:', message)
    return jsonResponse({ ok: false, error: message }, 500, corsHeaders)
  }
}

async function handleMetricsSyncRequest(request, env, corsHeaders) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientId = typeof body?.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim()
      : undefined
    const platform = typeof body?.platform === 'string' ? body.platform : 'facebook'

    if (platform !== 'facebook') {
      return jsonResponse({ ok: false, error: 'Only Facebook metrics sync is currently supported.' }, 400, corsHeaders)
    }

    const result = await syncFacebookMetrics(env, { clientId })
    return jsonResponse({ ok: true, platform: 'facebook', ...result }, 200, corsHeaders)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Metrics sync failed.'
    console.error('Metrics sync request failed:', message)
    return jsonResponse({ ok: false, error: message }, 500, corsHeaders)
  }
}

async function syncFacebookMetrics(env, options = {}) {
  const posts = await getPostedFacebookPostsForMetrics(env, options.clientId)

  if (!Array.isArray(posts) || posts.length === 0) {
    return {
      checkedCount: 0,
      syncedCount: 0,
      skippedCount: 0,
      errors: [],
    }
  }

  const connectionCache = new Map()
  const errors = []
  let syncedCount = 0
  let skippedCount = 0

  for (const post of posts) {
    try {
      let connection = connectionCache.get(post.user_id)
      if (connection === undefined) {
        connection = await getActiveMetaConnection(env, post.user_id)
        connectionCache.set(post.user_id, connection || null)
      }

      if (!connection?.page_access_token) {
        skippedCount += 1
        errors.push({ postId: post.id, message: MESSAGE.noActiveConnection })
        continue
      }

      const metricsAccessTokens = getFacebookMetricsAccessTokens(connection.page_access_token)

      if (metricsAccessTokens.length === 0) {
        skippedCount += 1
        errors.push({ postId: post.id, message: MESSAGE.noActiveConnection })
        continue
      }

      const metric = await fetchFacebookPostMetrics(post.facebook_post_id, metricsAccessTokens)
      const metricDate = (metric.createdTime || post.posted_at || post.date || new Date().toISOString()).split('T')[0]

      await upsertPerformanceMetric(env, {
        user_id: post.user_id,
        platform: 'facebook',
        caption: metric.caption || post.caption || 'Facebook post',
        date: metricDate,
        reach: metric.reach,
        likes: metric.likes,
        engagement_rate: metric.engagementRate,
      })

      syncedCount += 1
    } catch (error) {
      skippedCount += 1
      const message = error instanceof Error ? error.message : 'Unable to sync this Facebook post.'
      console.error('Failed to sync Facebook metrics for post', post.id, ':', message)
      errors.push({ postId: post.id, message })
    }
  }

  return {
    checkedCount: posts.length,
    syncedCount,
    skippedCount,
    errors: errors.slice(0, 5),
  }
}

async function listPerformanceMetrics(env, options = {}) {
  const query = {
    select: '*',
    user_id: `eq.${options.clientId}`,
    order: 'date.desc',
    limit: '200',
  }

  if (options.platform) {
    query.platform = `eq.${options.platform}`
  }

  const rows = await querySupabase(env, '/rest/v1/performance_metrics', query)
  return Array.isArray(rows) ? rows : []
}

async function getPostedFacebookPostsForMetrics(env, clientId) {
  const query = {
    select: 'id,user_id,caption,date,posted_at,facebook_post_id',
    posted_to_facebook: 'eq.true',
    facebook_post_id: 'not.is.null',
    order: 'posted_at.desc.nullslast,date.desc',
    limit: clientId ? '100' : '250',
  }

  if (clientId) {
    query.user_id = `eq.${clientId}`
  }

  return querySupabase(env, '/rest/v1/scheduled_posts', query)
}

async function fetchFacebookPostMetrics(facebookPostId, accessTokens) {
  const candidateTokens = Array.isArray(accessTokens) ? accessTokens.filter(Boolean) : [accessTokens].filter(Boolean)
  const attemptMessages = []

  for (const accessToken of candidateTokens) {
    try {
      const resolvedPostId = await resolveFacebookPostId(facebookPostId, accessToken)
      const insightData = await fetchFacebookPostInsights(resolvedPostId, accessToken)

      let metadata = {
        caption: '',
        createdTime: null,
        likes: 0,
        comments: 0,
        shares: 0,
      }

      try {
        metadata = await fetchFacebookPostMetadata(resolvedPostId, accessToken)
      } catch (error) {
        if (!isRecoverableFacebookMetricError(error)) {
          throw error
        }

        console.warn('Facebook post metadata is unavailable for token attempt; continuing with insights only for post', resolvedPostId)
      }

      const reach = insightData.reach
      const approxEngagementCount = metadata.likes + metadata.comments + metadata.shares
      const engagedUsers = Math.max(insightData.engagedUsers, approxEngagementCount)
      const likes = Math.max(metadata.likes, insightData.likeCount)
      const engagementRate = reach > 0 ? Number(((engagedUsers / reach) * 100).toFixed(2)) : 0

      return {
        caption: metadata.caption,
        createdTime: metadata.createdTime,
        reach,
        likes,
        engagementRate,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read Facebook metrics.'
      attemptMessages.push(message)

      if (!isRecoverableFacebookMetricError(error)) {
        throw new Error(message)
      }
    }
  }

  throw new Error(attemptMessages[0] || 'Unable to read Facebook metrics.')
}

async function resolveFacebookPostId(facebookPostId, pageAccessToken) {
  const rawId = String(facebookPostId || '').trim()

  if (!rawId || rawId.includes('_')) {
    return rawId
  }

  try {
    const url = new URL(`${META_GRAPH_BASE}/${rawId}`)
    url.searchParams.set('fields', 'id,post_id,page_story_id')
    url.searchParams.set('access_token', pageAccessToken)

    const response = await fetch(url)
    const json = await readMetaResponseBody(response)

    if (!response.ok || json.error) {
      throw buildFacebookMetricsError(response.status, json)
    }

    return json.page_story_id || json.post_id || rawId
  } catch (error) {
    if (isFacebookPermissionError(error)) {
      throw new Error(MESSAGE.facebookMetricsPermissionRequired)
    }

    return rawId
  }
}

async function fetchFacebookPostInsights(facebookPostId, accessToken) {
  const reach = await fetchFacebookInsightMetricValue(facebookPostId, accessToken, [
    'post_impressions_unique',
    'post_impressions',
    'post_impressions_paid_unique',
    'post_impressions_organic_unique',
  ])

  const engagedUsers = await fetchFacebookInsightMetricValue(facebookPostId, accessToken, [
    'post_engaged_users',
    'post_clicks',
    'post_activity_by_action_type',
    'post_reactions_by_type_total',
  ])

  const likeCount = await fetchFacebookLikeMetricValue(facebookPostId, accessToken)

  return {
    reach,
    engagedUsers,
    likeCount,
  }
}

async function fetchFacebookLikeMetricValue(facebookPostId, accessToken) {
  try {
    const url = new URL(`${META_GRAPH_BASE}/${facebookPostId}`)
    url.searchParams.set('fields', 'reactions.type(LIKE).limit(0).summary(total_count)')
    url.searchParams.set('access_token', accessToken)

    const response = await fetch(url)
    const json = await readMetaResponseBody(response)

    if (!response.ok || json.error) {
      throw buildFacebookMetricsError(response.status, json)
    }

    return Number(json.reactions?.summary?.total_count ?? 0) || 0
  } catch (error) {
    if (!isRecoverableFacebookMetricError(error)) {
      throw error
    }
  }

  return fetchFacebookInsightMetricNamedValue(facebookPostId, accessToken, [
    { metric: 'post_reactions_by_type_total', keys: ['like', 'LIKE'] },
    { metric: 'post_activity_by_action_type', keys: ['like', 'likes'] },
  ])
}

async function fetchFacebookInsightMetricValue(facebookPostId, accessToken, candidateMetrics) {
  const errors = []

  for (const metricName of candidateMetrics) {
    const url = new URL(`${META_GRAPH_BASE}/${facebookPostId}/insights`)
    url.searchParams.set('metric', metricName)
    url.searchParams.set('access_token', accessToken)

    const response = await fetch(url)
    const json = await readMetaResponseBody(response)

    if (!response.ok || json.error) {
      const error = buildFacebookMetricsError(response.status, json)
      const message = error instanceof Error ? error.message : String(error)

      if (isRecoverableFacebookMetricError(error) || /valid insights metric|invalid query/i.test(message)) {
        errors.push(message)
        continue
      }

      throw error
    }

    return extractFirstMetricValue(Array.isArray(json.data) ? json.data : [], [metricName])
  }

  if (errors.some((message) => /pages_read_engagement|page public content access|read_insights permission/i.test(message))) {
    throw new Error(errors[0])
  }

  return 0
}

async function fetchFacebookInsightMetricNamedValue(facebookPostId, accessToken, candidates) {
  const errors = []

  for (const candidate of candidates) {
    const url = new URL(`${META_GRAPH_BASE}/${facebookPostId}/insights`)
    url.searchParams.set('metric', candidate.metric)
    url.searchParams.set('access_token', accessToken)

    const response = await fetch(url)
    const json = await readMetaResponseBody(response)

    if (!response.ok || json.error) {
      const error = buildFacebookMetricsError(response.status, json)
      const message = error instanceof Error ? error.message : String(error)

      if (isRecoverableFacebookMetricError(error) || /valid insights metric|invalid query/i.test(message)) {
        errors.push(message)
        continue
      }

      throw error
    }

    return extractNamedMetricValue(Array.isArray(json.data) ? json.data : [], candidate.metric, candidate.keys)
  }

  if (errors.some((message) => /pages_read_engagement|page public content access|read_insights permission/i.test(message))) {
    throw new Error(errors[0])
  }

  return 0
}

async function fetchFacebookPostMetadata(facebookPostId, pageAccessToken) {
  const url = new URL(`${META_GRAPH_BASE}/${facebookPostId}`)
  url.searchParams.set(
    'fields',
    [
      'message',
      'created_time',
      'shares',
      'comments.limit(0).summary(total_count)',
      'reactions.type(LIKE).limit(0).summary(total_count)',
    ].join(',')
  )
  url.searchParams.set('access_token', pageAccessToken)

  const response = await fetch(url)
  const json = await readMetaResponseBody(response)

  if (!response.ok || json.error) {
    throw buildFacebookMetricsError(response.status, json)
  }

  return {
    caption: typeof json.message === 'string' ? json.message.trim() : '',
    createdTime: typeof json.created_time === 'string' ? json.created_time : null,
    likes: Number(json.likes?.summary?.total_count ?? json.reactions?.summary?.total_count ?? 0) || 0,
    comments: Number(json.comments?.summary?.total_count ?? 0) || 0,
    shares: Number(json.shares?.count ?? 0) || 0,
  }
}

function buildFacebookMetricsError(status, json) {
  const rawMessage = json?.error?.message || `Facebook metrics fetch failed (HTTP ${status}). ${json?.rawText || ''}`.trim()

  if (/pages_read_engagement|page public content access/i.test(rawMessage)) {
    return new Error(MESSAGE.facebookMetricsPermissionRequired)
  }

  if (/requires the 'read_insights' permission|read_insights permission/i.test(rawMessage)) {
    return new Error(MESSAGE.readInsightsReconnectRequired)
  }

  return new Error(rawMessage)
}

function isFacebookPermissionError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /pages_read_engagement|page public content access|read_insights permission/i.test(message)
}

function isInvalidFacebookAccessTokenError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /invalid oauth 2\.0 access token|error validating access token|session has expired/i.test(message)
}

function isRecoverableFacebookMetricError(error) {
  return isFacebookPermissionError(error) || isInvalidFacebookAccessTokenError(error)
}

async function upsertPerformanceMetric(env, metric) {
  const safeCaption = normalizeMetricCaption(metric.caption) || 'Facebook post'
  const safeDate = String(metric.date || new Date().toISOString().split('T')[0])
  const existingRows = await querySupabase(env, '/rest/v1/performance_metrics', {
    select: 'id,caption',
    user_id: `eq.${metric.user_id}`,
    platform: `eq.${metric.platform}`,
    date: `eq.${safeDate}`,
    limit: '50',
  })

  const existingMatch = Array.isArray(existingRows)
    ? existingRows.find((row) => normalizeMetricCaption(row.caption) === safeCaption)
    : null

  const payload = {
    ...metric,
    caption: safeCaption,
    date: safeDate,
  }

  if (existingMatch?.id) {
    return updateSupabase(env, `/rest/v1/performance_metrics?id=eq.${existingMatch.id}`, payload)
  }

  return insertSupabase(env, '/rest/v1/performance_metrics', payload)
}

function getFacebookMetricsAccessTokens(tokenValue) {
  const { pageAccessToken, userAccessToken } = parseStoredMetaTokens(tokenValue)
  return [...new Set([pageAccessToken, userAccessToken].filter(Boolean))]
}

async function getGrantedPermissions(accessToken) {
  const url = new URL(`${META_GRAPH_BASE}/me/permissions`)
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url)
  const json = await readMetaResponseBody(response)

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || 'Unable to verify Meta permissions.')
  }

  return Array.isArray(json.data)
    ? json.data.filter((entry) => entry?.status === 'granted').map((entry) => entry.permission)
    : []
}

function parseStoredMetaTokens(tokenValue) {
  const rawValue = String(tokenValue || '').trim()

  if (!rawValue) {
    return {
      pageAccessToken: '',
      userAccessToken: '',
    }
  }

  if (rawValue.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawValue)
      return {
        pageAccessToken: String(parsed.pageAccessToken || parsed.page_access_token || ''),
        userAccessToken: String(parsed.userAccessToken || parsed.user_access_token || ''),
      }
    } catch {
      // fall back to legacy raw token storage
    }
  }

  return {
    pageAccessToken: rawValue,
    userAccessToken: '',
  }
}

function serializeStoredMetaTokens({ pageAccessToken, userAccessToken }) {
  if (!userAccessToken) {
    return String(pageAccessToken || '')
  }

  return JSON.stringify({
    pageAccessToken: String(pageAccessToken || ''),
    userAccessToken: String(userAccessToken || ''),
  })
}

function normalizeMetricCaption(caption) {
  return String(caption || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMetricValue(metrics, name) {
  const metric = Array.isArray(metrics)
    ? metrics.find((item) => item?.name === name)
    : null
  const latestValue = Array.isArray(metric?.values) && metric.values.length > 0
    ? metric.values[metric.values.length - 1]?.value
    : 0

  if (typeof latestValue === 'number') {
    return latestValue
  }

  if (latestValue && typeof latestValue === 'object') {
    return Object.values(latestValue).reduce((sum, value) => sum + (Number(value) || 0), 0)
  }

  return Number(latestValue) || 0
}

function extractNamedMetricValue(metrics, metricName, keys) {
  const metric = Array.isArray(metrics)
    ? metrics.find((item) => item?.name === metricName)
    : null
  const latestValue = Array.isArray(metric?.values) && metric.values.length > 0
    ? metric.values[metric.values.length - 1]?.value
    : 0

  if (latestValue && typeof latestValue === 'object') {
    for (const key of keys) {
      if (key in latestValue) {
        return Number(latestValue[key]) || 0
      }
    }
  }

  return typeof latestValue === 'number' ? latestValue : Number(latestValue) || 0
}

function extractFirstMetricValue(metrics, names) {
  for (const name of names) {
    const value = extractMetricValue(metrics, name)
    if (value > 0) {
      return value
    }
  }

  return 0
}

function jsonResponse(payload, status = 200, headers = {}) {
  return Response.json(payload, {
    status,
    headers,
  })
}

function buildCorsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const allowedOrigins = getAllowedOrigins(env)
  const allowOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : Array.from(allowedOrigins)[0] || '*'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function getAllowedOrigins(env) {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS)

  if (env.PORTAL_URL) {
    try {
      origins.add(new URL(env.PORTAL_URL).origin)
    } catch {
      // ignore invalid portal URL values
    }
  }

  return origins
}

async function checkDailyPostLimit(env, clientId, platform) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  const rows = await querySupabase(env, '/rest/v1/post_logs', {
    select: 'id',
    client_id: `eq.${clientId}`,
    platform: `eq.${platform}`,
    status: 'eq.success',
    attempted_at: `gte.${start.toISOString()}`,
    and: `(attempted_at.lt.${end.toISOString()})`,
    limit: '201',
  })

  return Array.isArray(rows) && rows.length < 200
}

async function tryRefreshConnectionToken(env, connection, post) {
  try {
    const currentTokens = parseStoredMetaTokens(connection.page_access_token)
    const refreshSourceToken = currentTokens.userAccessToken || currentTokens.pageAccessToken
    const refreshed = await exchangeForLongLivedUserToken(env, refreshSourceToken)

    if (!refreshed?.access_token) {
      return connection
    }

    // Validate expires_in: use a default of 5,184,000 seconds (60 days) if missing or invalid
    const expiresInSeconds = typeof refreshed.expires_in === 'number' && refreshed.expires_in > 0
      ? refreshed.expires_in
      : 5184000 // 60 days

    let nextPageAccessToken = currentTokens.pageAccessToken

    try {
      const refreshedPages = await getUserPages(refreshed.access_token)
      const matchingPage = Array.isArray(refreshedPages)
        ? refreshedPages.find((page) => String(page.id) === String(connection.facebook_page_id))
        : null

      if (matchingPage?.access_token) {
        nextPageAccessToken = matchingPage.access_token
      }
    } catch (pageRefreshError) {
      console.warn('Unable to refresh page access token after Meta token refresh:', pageRefreshError?.message || pageRefreshError)
    }

    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    const updated = {
      page_access_token: serializeStoredMetaTokens({
        pageAccessToken: nextPageAccessToken,
        userAccessToken: refreshed.access_token,
      }),
      token_expires_at: tokenExpiresAt,
      connected_at: new Date().toISOString(),
    }

    await updateSupabase(env, `/rest/v1/meta_connections?id=eq.${connection.id}`, updated)

    return {
      ...connection,
      ...updated,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token refresh failed'
    console.error('Error refreshing Meta token for post', post.id, ':', errorMessage)

    if (!post.posted_to_facebook) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: 'facebook',
        status: 'skipped',
        error_message: MESSAGE.tokenRefreshFailed,
      })
    }

    if (!post.posted_to_instagram) {
      await insertPostLog(env, {
        post_id: post.id,
        client_id: post.user_id,
        platform: 'instagram',
        status: 'skipped',
        error_message: MESSAGE.tokenRefreshFailed,
      })
    }

    await updateScheduledPost(env, post.id, {
      post_error: MESSAGE.tokenRefreshFailed,
    })

    return connection
  }
}

async function getActiveMetaConnection(env, clientId) {
  const rows = await querySupabase(env, '/rest/v1/meta_connections', {
    select: '*',
    client_id: `eq.${clientId}`,
    is_active: 'eq.true',
    order: 'connected_at.desc',
    limit: '1',
  })

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

async function updateMetaConnectionsForClient(env, clientId, pages, tokenExpiresAt, userAccessToken) {
  const previousActive = await getActiveMetaConnection(env, clientId)
  const allowedPages = (pages || []).filter((page) => !BLOCKED_FACEBOOK_PAGE_IDS.has(String(page.id)))

  if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
    throw new Error('No allowed Facebook pages are available for this client account.')
  }

  await updateSupabase(env, `/rest/v1/meta_connections?client_id=eq.${encodeURIComponent(clientId)}`, {
    is_active: false,
  })

  const preferredPage =
    allowedPages.find((page) => String(page.id) === String(previousActive?.facebook_page_id)) ||
    allowedPages.find((page) => page.instagram_business_account?.id) ||
    allowedPages[0]

  for (const page of allowedPages) {
    await saveMetaConnection(env, {
      client_id: clientId,
      facebook_page_id: page.id,
      facebook_page_name: page.name || null,
      instagram_account_id: page.instagram_business_account?.id || null,
      page_access_token: serializeStoredMetaTokens({
        pageAccessToken: page.access_token,
        userAccessToken,
      }),
      token_expires_at: tokenExpiresAt,
      connected_at: new Date().toISOString(),
      is_active: String(page.id) === String(preferredPage?.id),
    })
  }
}

async function saveMetaConnection(env, connection) {
  return insertSupabase(env, '/rest/v1/meta_connections?on_conflict=client_id,facebook_page_id', connection, {
    Prefer: 'resolution=merge-duplicates,return=representation',
  })
}

async function updateScheduledPost(env, postId, updates) {
  return updateSupabase(env, `/rest/v1/scheduled_posts?id=eq.${postId}`, updates)
}

async function insertPostLog(env, logEntry) {
  return insertSupabase(env, '/rest/v1/post_logs', logEntry)
}

async function getUserPages(accessToken) {
  const url = new URL(`${META_GRAPH_BASE}/me/accounts`)
  url.searchParams.set('fields', 'id,name,access_token,instagram_business_account')
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url)
  const json = await response.json()
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || 'Failed to load user pages.')
  }

  return json.data || []
}

async function exchangeCodeForToken(env, code) {
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('client_id', env.META_APP_ID)
  url.searchParams.set('client_secret', env.META_APP_SECRET)
  url.searchParams.set('redirect_uri', env.META_REDIRECT_URI)
  url.searchParams.set('code', code)

  const response = await fetch(url)
  const json = await response.json()
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || 'Unable to exchange authorization code.')
  }

  return json
}

async function exchangeForLongLivedUserToken(env, token) {
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', env.META_APP_ID)
  url.searchParams.set('client_secret', env.META_APP_SECRET)
  url.searchParams.set('fb_exchange_token', token)

  const response = await fetch(url)
  const json = await response.json()
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || 'Unable to exchange long-lived token.')
  }

  return json
}

function redirectToPortal(env, params) {
  const target = new URL(env.PORTAL_URL)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, String(value))
  }
  return Response.redirect(target.toString(), 302)
}

async function assertPublicMediaUrl(url, contextLabel) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok) {
      return
    }

    // Some CDNs do not support HEAD for signed/object URLs; fallback to ranged GET.
    const ranged = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    })
    if (!ranged.ok) {
      throw new Error(`Media URL is not publicly reachable for ${contextLabel} (HEAD ${res.status}, GET ${ranged.status}).`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Media URL validation failed.'
    throw new Error(message)
  }
}

async function readMetaResponseBody(response) {
  const rawText = await response.text()
  if (!rawText) {
    return { rawText: '' }
  }

  try {
    const parsed = JSON.parse(rawText)
    return {
      ...parsed,
      rawText,
    }
  } catch {
    return { rawText }
  }
}

async function querySupabase(env, path, query) {
  const url = new URL(path, env.SUPABASE_URL)
  for (const [key, value] of Object.entries(query || {})) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.message || `Supabase query failed: ${response.status}`)
  }

  return json
}

async function insertSupabase(env, path, payload, extraHeaders = {}) {
  return writeSupabase(env, path, 'POST', payload, extraHeaders)
}

async function updateSupabase(env, path, payload) {
  return writeSupabase(env, path, 'PATCH', payload)
}

async function writeSupabase(env, path, method, payload, extraHeaders = {}) {
  const response = await fetch(new URL(path, env.SUPABASE_URL), {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=minimal',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase write failed: ${response.status} ${text}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return null
}

