(() => {
  "use strict";

  const sessionKey = "blend.auth.session";
  let session = readSession();

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "null");
    } catch (error) {
      console.warn("Could not read the signed-in session.", error);
      return null;
    }
  }

  function saveSession(value) {
    session = value;
    if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
    else localStorage.removeItem(sessionKey);
  }

  async function request(action, { method = "GET", body, id, canRefresh = true } = {}) {
    const query = new URLSearchParams({ action });
    if (id) query.set("id", id);
    const headers = { Accept: "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const result = await fetch(`/api?${query}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = result.status === 204 ? null : await result.json();
    if (result.status === 401 && canRefresh && session?.refresh_token && !action.startsWith("auth.")) {
      const refreshed = await request("auth.refresh", {
        method: "POST",
        body: { refresh_token: session.refresh_token },
        canRefresh: false
      });
      if (refreshed.access_token) {
        saveSession(refreshed);
        return request(action, { method, body, id, canRefresh: false });
      }
    }
    if (!result.ok) throw new Error(payload?.error || `Request failed (${result.status}).`);
    return payload;
  }

  async function authenticate(action, details) {
    const result = await request(action, { method: "POST", body: details, canRefresh: false });
    if (result?.access_token) saveSession(result);
    return result;
  }

  window.BlendBackend = Object.freeze({
    get session() { return session; },
    get isAuthenticated() { return Boolean(session?.access_token); },
    health: () => request("health"),
    signUp: details => authenticate("auth.signup", details),
    signIn: details => authenticate("auth.login", details),
    signOut: async () => {
      if (session?.access_token) await request("auth.logout", { method: "POST", body: {} });
      saveSession(null);
    },
    bootstrap: () => request("bootstrap"),
    updateProfile: profile => request("profile.update", { method: "PATCH", body: profile }),
    createPost: post => request("posts.create", { method: "POST", body: post }),
    deletePost: id => request("posts.delete", { method: "DELETE", id }),
    setLike: (id, liked) => request("posts.like", { method: liked ? "POST" : "DELETE", id }),
    setSaved: (id, saved) => request("posts.save", { method: saved ? "POST" : "DELETE", id }),
    createComment: comment => request("comments.create", { method: "POST", body: comment }),
    setFollowing: (id, following) => request("follows.toggle", { method: following ? "POST" : "DELETE", id }),
    createStory: story => request("stories.create", { method: "POST", body: story }),
    deleteStory: id => request("stories.delete", { method: "DELETE", id }),
    startConversation: profileId => request("messages.start", { method: "POST", body: { profile_id: profileId } }),
    sendMessage: message => request("messages.send", { method: "POST", body: message }),
    uploadMedia: dataUrl => request("media.upload", { method: "POST", body: { dataUrl } })
  });
})();
