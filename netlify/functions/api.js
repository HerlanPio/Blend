"use strict";

const { randomUUID } = require("node:crypto");

const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const PROFILE_SELECT = "id,display_name,age,occupation,city,bio,avatar_url,intent";
const OWN_PROFILE_SELECT = `${PROFILE_SELECT},discoverable,allow_message_requests,default_story_audience`;

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    },
    body: JSON.stringify(payload)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    const parsed = JSON.parse(event.body);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Request body must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) throw new HttpError(400, "Request body must be valid JSON.");
    throw error;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function configuration() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(503, "Backend is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  return { url, key };
}

async function supabaseRequest(config, endpoint, options = {}) {
  const headers = {
    apikey: config.key,
    "Content-Type": "application/json",
    ...options.headers
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const result = await fetch(`${config.url}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await result.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = null; }
  if (!result.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error;
    const status = [400, 401, 403, 404, 409, 422].includes(result.status) ? result.status : 502;
    throw new HttpError(status, message || "The backend request failed.");
  }
  return payload;
}

function restPath(table, query = {}) {
  const params = new URLSearchParams(query);
  return `/rest/v1/${table}${params.size ? `?${params}` : ""}`;
}

async function database(config, token, table, method = "GET", query, body) {
  return supabaseRequest(config, restPath(table, query), {
    method,
    token,
    body,
    headers: {
      Prefer: "return=representation",
      ...(method === "GET" ? { Accept: "application/json" } : {})
    }
  });
}

async function upsert(config, token, table, conflict, body) {
  return supabaseRequest(config, `/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: "POST",
    token,
    body,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" }
  });
}

async function requireUser(config, event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sign in to use this feature.");
  const user = await supabaseRequest(config, "/auth/v1/user", { token });
  if (!user?.id) throw new HttpError(401, "Your session is not valid. Please sign in again.");
  return { token, user };
}

function requiredText(value, label, maximum) {
  if (typeof value !== "string") throw new HttpError(400, `${label} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new HttpError(400, `${label} must be between 1 and ${maximum} characters.`);
  }
  return normalized;
}

async function bootstrap(config, token, user) {
  const queries = [
    database(config, token, "profiles", "GET", { select: PROFILE_SELECT, order: "display_name.asc", limit: "100" }),
    database(config, token, "posts", "GET", {
      select: `*,author:profiles!posts_author_id_fkey(${PROFILE_SELECT})`,
      order: "created_at.desc",
      limit: "50"
    }),
    database(config, token, "stories", "GET", {
      select: `*,author:profiles!stories_author_id_fkey(${PROFILE_SELECT})`,
      expires_at: `gt.${new Date().toISOString()}`,
      order: "created_at.desc",
      limit: "50"
    }),
    database(config, token, "likes", "GET", { select: "post_id", user_id: `eq.${user.id}`, limit: "200" }),
    database(config, token, "bookmarks", "GET", { select: "post_id", user_id: `eq.${user.id}`, limit: "200" }),
    database(config, token, "follows", "GET", { select: "follower_id,followee_id", limit: "500" }),
    database(config, token, "comments", "GET", {
      select: `id,post_id,content,created_at,author:profiles!comments_author_id_fkey(${PROFILE_SELECT})`,
      order: "created_at.asc",
      limit: "500"
    }),
    database(config, token, "conversation_members", "GET", {
      select: `conversation_id,profile:profiles!conversation_members_profile_id_fkey(${PROFILE_SELECT})`,
      profile_id: `eq.${user.id}`,
      limit: "100"
    }),
    database(config, token, "member_blocks", "GET", {
      select: "blocked_id",
      blocker_id: `eq.${user.id}`,
      limit: "500"
    })
  ];
  const [profiles, posts, stories, likes, bookmarks, follows, comments, memberships, blocks] = await Promise.all(queries);
  const conversationIds = memberships.map(item => item.conversation_id);
  const messages = conversationIds.length
    ? await database(config, token, "messages", "GET", {
      select: "id,conversation_id,sender_id,content,created_at",
      conversation_id: `in.(${conversationIds.join(",")})`,
      order: "created_at.asc",
      limit: "500"
    })
    : [];
  const [profile] = await database(config, token, "profiles", "GET", {
    select: OWN_PROFILE_SELECT,
    id: `eq.${user.id}`,
    limit: "1"
  });
  const mediaPaths = [...new Set([
    ...profiles.filter(item => !blocks.some(block => block.blocked_id === item.id)).map(item => item.avatar_url),
    ...posts.map(item => item.media_url),
    ...stories.map(item => item.media_url),
    profile?.avatar_url
  ].filter(Boolean))];
  const signedMedia = new Map(await Promise.all(mediaPaths.map(async path => [path, await signMedia(config, token, path)])));
  const signProfile = item => ({
    ...item,
    avatar_path: item.avatar_url,
    avatar_url: blocks.some(block => block.blocked_id === item.id) ? "" : signedMedia.get(item.avatar_url) || ""
  });
  const signPost = item => ({
    ...item,
    media_path: item.media_url,
    media_url: signedMedia.get(item.media_url) || ""
  });
  const signStory = item => ({
    ...item,
    media_path: item.media_url,
    media_url: signedMedia.get(item.media_url) || ""
  });
  return {
    user: { id: user.id, email: user.email },
    profile: profile ? signProfile(profile) : null,
    profiles: profiles.map(signProfile),
    posts: posts.map(signPost),
    stories: stories.map(signStory),
    likedPostIds: likes.map(item => item.post_id),
    savedPostIds: bookmarks.map(item => item.post_id),
    follows,
    blockedIds: blocks.map(block => block.blocked_id),
    comments,
    conversations: memberships.map(item => ({
      id: item.conversation_id,
      person: item.profile
    })),
    messages
  };
}

function mediaPath(value) {
  if (typeof value !== "string" || !value || value.startsWith("/") || value.split("/").some(part => !part || part === "." || part === "..")) {
    throw new HttpError(400, "Media path is invalid.");
  }
  return value;
}

function ownedMediaPath(value, userId) {
  if (!value) return "";
  const safePath = mediaPath(value);
  if (!safePath.startsWith(`${userId}/`)) throw new HttpError(400, "Media must belong to your account.");
  return safePath;
}

async function signMedia(config, token, path) {
  const safePath = mediaPath(path);
  const encodedPath = safePath.split("/").map(encodeURIComponent).join("/");
  const result = await supabaseRequest(config, `/storage/v1/object/sign/blend-media/${encodedPath}`, {
    method: "POST",
    token,
    body: { expiresIn: 3600 }
  });
  if (!result?.signedURL) throw new HttpError(502, "Could not prepare media for viewing.");
  return `${config.url}/storage/v1${result.signedURL}`;
}

async function uploadMedia(config, token, user, body) {
  const match = typeof body.dataUrl === "string"
    && body.dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new HttpError(400, "Choose a supported image or video file.");
  const [, contentType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_MEDIA_BYTES) {
    throw new HttpError(413, "Media must be smaller than 5 MB.");
  }
  if (bytes.toString("base64") !== base64) throw new HttpError(400, "The uploaded media is invalid.");
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm"
  };
  const fileName = `${user.id}/${randomUUID()}.${extensions[contentType]}`;
  const upload = await fetch(`${config.url}/storage/v1/object/blend-media/${fileName}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: bytes
  });
  if (!upload.ok) {
    const result = await upload.json().catch(() => ({}));
    throw new HttpError(upload.status === 401 || upload.status === 403 ? upload.status : 502,
      result.message || result.error || "Could not upload the media.");
  }
  return {
    url: await signMedia(config, token, fileName),
    path: fileName,
    type: contentType.startsWith("video/") ? "video" : "image"
  };
}

async function route(event, config, token, user, body) {
  const action = event.queryStringParameters?.action;
  const id = event.queryStringParameters?.id;
  const method = event.httpMethod;

  if (action === "bootstrap" && method === "GET") return bootstrap(config, token, user);
  if (action === "profile.update" && method === "PATCH") {
    const profile = {
      display_name: requiredText(body.display_name, "Name", 80),
      age: body.age === "" || body.age == null ? null : Number(body.age),
      occupation: String(body.occupation || "").trim().slice(0, 120),
      city: String(body.city || "").trim().slice(0, 120),
      bio: String(body.bio || "").trim().slice(0, 500),
      avatar_url: ownedMediaPath(body.avatar_path, user.id),
      intent: body.intent || "A real connection"
    };
    if (body.discoverable !== undefined) {
      if (typeof body.discoverable !== "boolean") throw new HttpError(400, "Choose a valid profile visibility setting.");
      profile.discoverable = body.discoverable;
    }
    if (body.allow_message_requests !== undefined) {
      if (typeof body.allow_message_requests !== "boolean") throw new HttpError(400, "Choose a valid message request setting.");
      profile.allow_message_requests = body.allow_message_requests;
    }
    if (body.default_story_audience !== undefined) {
      const audience = ({ Everyone: "public", "Connections only": "followers", "Only me": "private" })[body.default_story_audience] || body.default_story_audience;
      if (!["public", "followers", "private"].includes(audience)) throw new HttpError(400, "Choose a valid default story audience.");
      profile.default_story_audience = audience;
    }
    if (profile.age !== null && (!Number.isInteger(profile.age) || profile.age < 18 || profile.age > 120)) {
      throw new HttpError(400, "Age must be between 18 and 120.");
    }
    if (!["A real connection", "New friends", "Just exploring"].includes(profile.intent)) {
      throw new HttpError(400, "Choose a valid connection intention.");
    }
    const [updated] = await database(config, token, "profiles", "PATCH", { id: `eq.${user.id}`, select: OWN_PROFILE_SELECT }, profile);
    return {
      ...updated,
      avatar_path: updated.avatar_url,
      avatar_url: updated.avatar_url ? await signMedia(config, token, updated.avatar_url) : ""
    };
  }
  if (action === "posts.create" && method === "POST") {
    const audience = ({ Everyone: "public", "Connections only": "followers", "Only me": "private" })[body.audience] || body.audience;
    if (!["public", "followers", "private"].includes(audience)) throw new HttpError(400, "Choose a valid audience.");
    const [post] = await database(config, token, "posts", "POST", {
      select: `*,author:profiles!posts_author_id_fkey(${PROFILE_SELECT})`
    }, {
      author_id: user.id,
      caption: requiredText(body.caption, "Caption", 500),
      media_url: ownedMediaPath(body.media_path, user.id),
      location: String(body.location || "").trim().slice(0, 120),
      audience
    });
    return {
      ...post,
      media_path: post.media_url,
      media_url: post.media_url ? await signMedia(config, token, post.media_url) : ""
    };
  }
  if (action === "posts.delete" && method === "DELETE" && id) {
    await database(config, token, "posts", "DELETE", { id: `eq.${id}`, author_id: `eq.${user.id}` });
    return { deleted: true };
  }
  if (action === "posts.like" && id && method === "POST") {
    await upsert(config, token, "likes", "user_id,post_id", { user_id: user.id, post_id: id });
    return { liked: true };
  }
  if (action === "posts.like" && id && method === "DELETE") {
    await database(config, token, "likes", "DELETE", { user_id: `eq.${user.id}`, post_id: `eq.${id}` });
    return { liked: false };
  }
  if (action === "posts.save" && id && method === "POST") {
    await upsert(config, token, "bookmarks", "user_id,post_id", { user_id: user.id, post_id: id });
    return { saved: true };
  }
  if (action === "posts.save" && id && method === "DELETE") {
    await database(config, token, "bookmarks", "DELETE", { user_id: `eq.${user.id}`, post_id: `eq.${id}` });
    return { saved: false };
  }
  if (action === "comments.create" && method === "POST") {
    const [comment] = await database(config, token, "comments", "POST", {
      select: `id,post_id,content,created_at,author:profiles!comments_author_id_fkey(${PROFILE_SELECT})`
    }, {
      author_id: user.id,
      post_id: requiredText(body.post_id, "Post", 80),
      content: requiredText(body.content, "Comment", 1000)
    });
    return comment;
  }
  if (action === "follows.toggle" && id && method === "POST") {
    if (id === user.id) throw new HttpError(400, "You cannot follow your own profile.");
    await upsert(config, token, "follows", "follower_id,followee_id", { follower_id: user.id, followee_id: id });
    return { following: true };
  }
  if (action === "follows.toggle" && id && method === "DELETE") {
    await database(config, token, "follows", "DELETE", { follower_id: `eq.${user.id}`, followee_id: `eq.${id}` });
    return { following: false };
  }
  if (action === "safety.block" && method === "POST") {
    const profileId = requiredUuid(body.profile_id, "Profile");
    if (profileId === user.id) throw new HttpError(400, "You cannot block your own profile.");
    await supabaseRequest(config, "/rest/v1/rpc/block_member", {
      method: "POST",
      token,
      body: { other_profile: profileId }
    });
    return { blocked: true };
  }
  if (action === "safety.block" && method === "DELETE" && id) {
    const profileId = requiredUuid(id, "Profile");
    await database(config, token, "member_blocks", "DELETE", {
      blocker_id: `eq.${user.id}`,
      blocked_id: `eq.${profileId}`
    });
    return { blocked: false };
  }
  if (action === "reports.create" && method === "POST") {
    const targetType = body.target_type;
    if (!["profile", "post"].includes(targetType)) throw new HttpError(400, "Choose a valid report target.");
    const reason = body.reason;
    if (!["spam", "harassment", "inappropriate", "other"].includes(reason)) throw new HttpError(400, "Choose a valid report reason.");
    const targetId = requiredUuid(body.target_id, "Report target");
    await supabaseRequest(config, restPath("content_reports"), {
      method: "POST",
      token,
      body: {
        reporter_id: user.id,
        reported_profile_id: targetType === "profile" ? targetId : null,
        reported_post_id: targetType === "post" ? targetId : null,
        reason,
        details: String(body.details || "").trim().slice(0, 1000)
      },
      headers: { Prefer: "return=minimal" }
    });
    return { submitted: true };
  }
  if (action === "stories.create" && method === "POST") {
    const audience = ({ Everyone: "public", "Connections only": "followers", "Only me": "private" })[body.audience] || body.audience || "public";
    if (!["public", "followers", "private"].includes(audience)) throw new HttpError(400, "Choose a valid story audience.");
    const [story] = await database(config, token, "stories", "POST", {
      select: `*,author:profiles!stories_author_id_fkey(${PROFILE_SELECT})`
    }, {
      author_id: user.id,
      caption: String(body.caption || "").trim().slice(0, 180),
      media_url: ownedMediaPath(requiredText(body.media_path, "Story media", 2048), user.id),
      media_type: body.media_type === "video" ? "video" : "image",
      audience
    });
    return {
      ...story,
      media_path: story.media_url,
      media_url: await signMedia(config, token, story.media_url)
    };
  }
  if (action === "stories.delete" && method === "DELETE" && id) {
    await database(config, token, "stories", "DELETE", { id: `eq.${id}`, author_id: `eq.${user.id}` });
    return { deleted: true };
  }
  if (action === "messages.start" && method === "POST") {
    const result = await supabaseRequest(config, "/rest/v1/rpc/start_conversation", {
      method: "POST",
      token,
      body: { other_profile: requiredText(body.profile_id, "Profile", 80) }
    });
    return { id: result };
  }
  if (action === "messages.send" && method === "POST") {
    const message = await supabaseRequest(config, "/rest/v1/rpc/send_message", {
      method: "POST",
      token,
      body: {
        target_conversation: requiredText(body.conversation_id, "Conversation", 80),
        message_content: requiredText(body.content, "Message", 2000)
      }
    });
    return message;
  }
  if (action === "media.upload" && method === "POST") return uploadMedia(config, token, user, body);
  throw new HttpError(404, "API route not found.");
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { ...response(204, {}), body: "" };
  if (event.httpMethod === "GET" && event.queryStringParameters?.action === "health") {
    return response(200, {
      configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    });
  }

  try {
    if (!["GET", "POST", "PATCH", "DELETE"].includes(event.httpMethod)) {
      throw new HttpError(405, "Method not allowed.");
    }
    const body = parseBody(event);
    const action = event.queryStringParameters?.action;
    const config = configuration();
    if (action === "auth.signup" && event.httpMethod === "POST") {
      const email = requiredText(body.email, "Email", 254).toLowerCase();
      if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128) {
        throw new HttpError(400, "Choose a password between 10 and 128 characters.");
      }
      const result = await supabaseRequest(config, "/auth/v1/signup", {
        method: "POST",
        body: {
          email,
          password: body.password,
          data: { display_name: requiredText(body.display_name, "Name", 80) }
        }
      });
      return response(200, result);
    }
    if (action === "auth.login" && event.httpMethod === "POST") {
      const result = await supabaseRequest(config, "/auth/v1/token?grant_type=password", {
        method: "POST",
        body: {
          email: requiredText(body.email, "Email", 254).toLowerCase(),
          password: validatePassword(body.password)
        }
      });
      return response(200, result);
    }
    if (action === "auth.refresh" && event.httpMethod === "POST") {
      return response(200, await supabaseRequest(config, "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: requiredText(body.refresh_token, "Refresh token", 4096) }
      }));
    }
    if (action === "auth.logout" && event.httpMethod === "POST") {
      const { token } = await requireUser(config, event);
      await supabaseRequest(config, "/auth/v1/logout", { method: "POST", token });
      return response(200, { loggedOut: true });
    }
    const { token, user } = await requireUser(config, event);
    return response(200, await route(event, config, token, user, body));
  } catch (error) {
    if (error instanceof HttpError) return response(error.status, { error: error.message });
    console.error("Blend API request failed:", error.message);
    return response(500, { error: "The backend could not complete this request." });
  }
}

function validatePassword(password) {
  if (typeof password !== "string" || !password || password.length > 128) {
    throw new HttpError(400, "Enter a valid password.");
  }
  return password;
}

function requiredUuid(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, `${label} is invalid.`);
  }
  return value;
}

exports.handler = handler;
