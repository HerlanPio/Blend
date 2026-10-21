(() => {
  "use strict";

  const data = window.BLEND_DATA;
  const root = document.querySelector("#view-root");
  const modalRoot = document.querySelector("#modal-root");
  const suggestions = document.querySelector("#suggestion-list");
  const backend = window.BlendBackend;
  const demoPeople = [...data.people];
  const storeKey = "blend.rebuilt.";
  let currentStoryQueue = [];
  let currentStoryIndex = 0;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(storeKey + key)) ?? fallback; }
    catch (error) { console.warn(`Could not read ${key} from local storage.`, error); return fallback; }
  };
  const write = (key, value) => {
    if (state.remote) return;
    try { localStorage.setItem(storeKey + key, JSON.stringify(value)); }
    catch (error) { console.error(`Could not save ${key} to local storage.`, error); toast("Could not save this change on your device."); }
  };
  const state = {
    view: "home",
    filter: "For you",
    query: "",
    selectedPerson: "sofia",
    myId: backend.session?.user?.id || "maya",
    remote: false,
    authMode: "login",
    mediaRefreshTimer: null,
    remoteProfiles: [],
    remoteStories: [],
    followers: [],
    conversationIds: {},
    profile: read("profile", { name: "Maya Chen", age: "28", occupation: "Product designer", city: "Brooklyn", bio: "Designing a life with room for Sunday markets, overwatered plants, and people who make anywhere feel like home.", image: "" }),
    posts: read("posts", []),
    likes: read("likes", []),
    saved: read("saved", []),
    connections: read("connections", []),
    comments: read("comments", {}),
    messages: read("messages", {}),
    intent: read("intent", "A real connection"),
    privacy: read("privacy", { discoverable: true, allowMessageRequests: true, defaultStoryAudience: "public" }),
    blockedIds: read("blocked", [])
  };

  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const personFor = id => data.people.find(person => person.id === id) || {
    id: id || "member",
    name: "Blend member",
    age: "",
    occupation: "",
    city: "",
    bio: "",
    image: "assets/blend-mark.svg",
    interests: []
  };
  const profileImage = () => state.profile.image || photo(personFor(state.myId).image, 160);
  function photo(source, width = 640) {
    if (/^(https?:|data:|blob:|assets\/)/i.test(source || "")) return escape(source);
    return `https://images.unsplash.com/${String(source || "").startsWith("photo-") ? source : `photo-${source}`}?auto=format&fit=crop&w=${width}&q=82`;
  }
  function avatar(person, size = 120) {
    const src = person.id === state.myId ? profileImage() : (person.image ? photo(person.image, size) : "assets/blend-mark.svg");
    return `<img class="avatar" src="${src}" alt="${escape(person.name)}" loading="lazy">`;
  }
  function toast(message) {
    document.querySelector(".toast")?.remove();
    const element = document.createElement("div");
    element.className = "toast";
    element.setAttribute("role", "status");
    element.textContent = message;
    document.body.append(element);
    window.setTimeout(() => element.remove(), 3000);
  }
  function showModal(content, label) {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-dismiss="modal"><section class="modal-card" role="dialog" aria-modal="true" aria-label="${escape(label)}"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button>${content}</section></div>`;
    modalRoot.querySelector(".modal-close").focus();
  }
  function closeModal() { modalRoot.innerHTML = ""; }
  function allPosts() {
    const hidden = new Set(state.blockedIds);
    return (state.remote ? [...state.posts] : [...state.posts, ...data.posts]).filter(post => !hidden.has(post.person));
  }
  function communityPeople() {
    return state.remote
      ? state.remoteProfiles.filter(person => person.id !== state.myId && !state.blockedIds.includes(person.id))
      : data.people.filter(person => person.id !== state.myId && !state.blockedIds.includes(person.id));
  }
  function profileFromRemote(profile) {
    return {
      id: profile.id,
      name: profile.display_name,
      age: profile.age || "",
      occupation: profile.occupation || "",
      city: profile.city || "",
      bio: profile.bio || "",
      image: profile.avatar_url || "",
      avatarPath: profile.avatar_path || "",
      interests: [],
      remote: true
    };
  }
  function postFromRemote(post) {
    return {
      id: post.id,
      person: post.author_id,
      image: post.media_url,
      mediaPath: post.media_path || "",
      caption: post.caption,
      location: post.location,
      audience: post.audience,
      likes: post.likes_count,
      comments: post.comments_count,
      time: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(post.created_at)),
      tags: [],
      remote: true
    };
  }
  function installRemoteState(remote) {
    const ownProfile = remote.profile;
    if (!ownProfile) throw new Error("Your account profile was not found. Please contact support.");
    state.remote = true;
    state.myId = remote.user.id;
    state.profile = {
      name: ownProfile.display_name,
      age: ownProfile.age || "",
      occupation: ownProfile.occupation || "",
      city: ownProfile.city || "",
      bio: ownProfile.bio || "",
      image: ownProfile.avatar_url || "",
      avatarPath: ownProfile.avatar_path || "",
      intent: ownProfile.intent,
      remote: true
    };
    state.intent = ownProfile.intent || "A real connection";
    state.privacy = {
      discoverable: ownProfile.discoverable !== false,
      allowMessageRequests: ownProfile.allow_message_requests !== false,
      defaultStoryAudience: ownProfile.default_story_audience || "public"
    };
    state.blockedIds = remote.blockedIds || [];
    const remoteProfiles = remote.profiles.map(profileFromRemote);
    state.remoteProfiles = remoteProfiles;
    data.people = remoteProfiles;
    state.posts = remote.posts.map(postFromRemote).reverse();
    state.remoteStories = remote.stories.map(story => ({
      id: story.id,
      person: story.author_id,
      image: story.media_url,
      mediaPath: story.media_path || "",
      type: story.media_type,
      caption: story.caption
    }));
    state.likes = remote.likedPostIds;
    state.saved = remote.savedPostIds;
    state.connections = remote.follows.filter(follow => follow.follower_id === state.myId).map(follow => follow.followee_id);
    state.followers = remote.follows.filter(follow => follow.followee_id === state.myId).map(follow => follow.follower_id);
    state.comments = remote.comments.reduce((comments, item) => {
      (comments[item.post_id] ||= []).push({
        content: item.content,
        author: item.author?.display_name || "Blend member"
      });
      return comments;
    }, {});
    state.conversationIds = {};
    state.messages = {};
    remote.conversations.forEach(conversation => {
      const personId = conversation.person.id;
      state.conversationIds[personId] = conversation.id;
      state.messages[personId] = [];
      (state.messages.$conversations ||= {})[conversation.id] = personId;
    });
    remote.messages.forEach(message => {
      const personId = state.messages.$conversations?.[message.conversation_id];
      if (personId) state.messages[personId].push({
        content: message.content,
        mine: message.sender_id === state.myId
      });
    });
    delete state.messages.$conversations;
    state.selectedPerson = communityPeople()[0]?.id || "";
    const ownStory = remote.stories.find(story => story.author_id === state.myId);
    if (ownStory) {
      state.profile.storyId = ownStory.id;
      state.profile.storyImage = ownStory.media_url;
      state.profile.storyPath = ownStory.media_path;
      state.profile.storyType = ownStory.media_type;
      state.profile.storyCaption = ownStory.caption;
    }
  }
  async function refreshRemoteState() {
    installRemoteState(await backend.bootstrap());
    render();
    window.clearTimeout(state.mediaRefreshTimer);
    state.mediaRefreshTimer = window.setTimeout(() => {
      refreshRemoteState().catch(error => {
        console.error("Could not refresh Blend media links.", error);
        toast("Could not refresh your Blend media. Please check your connection.");
      });
    }, 50 * 60 * 1000);
  }
  function isRemoteId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || "");
  }
  function accountModal(message = "") {
    if (backend.isAuthenticated) {
      showModal(`<span class="section-kicker">YOUR BLEND ACCOUNT</span><h2>You’re signed in.</h2><p class="modal-description">${escape(backend.session.user?.email || "Your account")}</p><p class="upload-error" ${message ? "" : "hidden"}>${escape(message)}</p><button class="primary-button" data-action="sign-out">Sign out</button>`, "Your account");
      return;
    }
    showModal(`<span class="section-kicker">YOUR BLEND ACCOUNT</span><h2>Make your world yours.</h2><p class="modal-description">Sign in to keep your profile, stories, moments, and messages in sync across devices.</p><div class="auth-mode"><button class="${state.authMode !== "signup" ? "active" : ""}" data-action="auth-mode" data-mode="login">Sign in</button><button class="${state.authMode === "signup" ? "active" : ""}" data-action="auth-mode" data-mode="signup">Create account</button></div><form id="account-form" class="create-form">${state.authMode === "signup" ? '<label>Your name<input name="display_name" required maxlength="80" autocomplete="name"></label>' : ""}<label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required ${state.authMode === "signup" ? 'minlength="10"' : ""} autocomplete="${state.authMode === "signup" ? "new-password" : "current-password"}"></label><p class="upload-error" ${message ? "" : "hidden"}>${escape(message)}</p><button class="primary-button" type="submit">${state.authMode === "signup" ? "Create my account" : "Sign in"} ↗</button></form>`, "Sign in to Blend");
  }
  function privacyModal() {
    const audience = state.privacy.defaultStoryAudience || "public";
    const blockedPeople = state.blockedIds.length
      ? state.blockedIds.map(id => `<div class="profile-person-row">${avatar(personFor(id))}<span><strong>${escape(personFor(id).name)}</strong><small>Blocked account</small></span><button class="text-button" data-action="unblock-member" data-person-id="${escape(id)}">Unblock</button></div>`).join("")
      : '<p class="empty-state">You haven’t blocked anyone.</p>';
    showModal(`<span class="section-kicker">YOUR PRIVACY, YOUR PACE</span><h2>Privacy and safety.</h2><p class="modal-description">Choose how people can find you and what you share. Existing conversations can continue if you turn off new message requests.</p><form id="privacy-form" class="create-form"><label>Profile discoverability<select name="discoverable"><option value="true" ${state.privacy.discoverable ? "selected" : ""}>Show me in Discover</option><option value="false" ${state.privacy.discoverable ? "" : "selected"}>Hide me from Discover</option></select></label><label>New message requests<select name="allow_message_requests"><option value="true" ${state.privacy.allowMessageRequests ? "selected" : ""}>Allow new requests</option><option value="false" ${state.privacy.allowMessageRequests ? "" : "selected"}>Turn off new requests</option></select></label><label>Default story audience<select name="default_story_audience"><option value="public" ${audience === "public" ? "selected" : ""}>Everyone</option><option value="followers" ${audience === "followers" ? "selected" : ""}>My followers</option><option value="private" ${audience === "private" ? "selected" : ""}>Only me</option></select></label><p class="upload-error" hidden></p><button class="primary-button" type="submit">Save privacy settings ✓</button></form><section class="privacy-blocked"><span class="section-kicker">BLOCKED ACCOUNTS</span>${blockedPeople}</section>`, "Privacy and safety settings");
  }
  function memberOptionsModal(personId) {
    const person = personFor(personId);
    showModal(`<span class="section-kicker">YOUR SPACE, YOUR CHOICE</span><h2>${escape(person.name)}</h2><p class="modal-description">Choose what feels right for your experience on Blend.</p><button class="primary-button" data-action="report-profile" data-person-id="${escape(personId)}">Report profile</button><button class="text-button" data-action="confirm-block" data-person-id="${escape(personId)}" style="margin-top:12px">Block this account</button>`, "Member options");
  }
  function reportModal(targetType, targetId) {
    if (!state.remote) {
      showModal('<span class="section-kicker">A SAFER BLEND</span><h2>Sign in to report.</h2><p class="modal-description">Reports are submitted to Blend with a signed-in account.</p><button class="primary-button" data-action="account">Account & sign in</button>', "Report content");
      return;
    }
    showModal(`<span class="section-kicker">HELP KEEP BLEND KIND</span><h2>Report this ${targetType}.</h2><form id="report-form" class="create-form" data-target-type="${escape(targetType)}" data-target-id="${escape(targetId)}"><label>What’s the concern?<select name="reason"><option value="spam">Spam</option><option value="harassment">Harassment or bullying</option><option value="inappropriate">Inappropriate content</option><option value="other">Something else</option></select></label><label>Anything else we should know?<textarea name="details" maxlength="1000" placeholder="Add a little context (optional)…"></textarea></label><p class="upload-error" hidden></p><button class="primary-button" type="submit">Send report</button></form>`, "Report content");
  }
  function blockConfirmModal(personId) {
    const person = personFor(personId);
    showModal(`<span class="section-kicker">YOU’RE IN CONTROL</span><h2>Block ${escape(person.name)}?</h2><p class="modal-description">They’ll be removed from your feed and discovery. You won’t see each other’s stories or be able to message.</p><button class="primary-button" data-action="block-member" data-person-id="${escape(personId)}">Block account</button><button class="text-button" data-action="close-modal" style="margin-top:10px">Keep them unblocked</button>`, "Block account");
  }
  function profileUpdatePayload(profile = state.profile, privacy = state.privacy, intent = state.intent) {
    return {
      display_name: profile.name,
      age: profile.age,
      occupation: profile.occupation,
      city: profile.city,
      bio: profile.bio,
      avatar_path: profile.avatarPath || "",
      intent,
      discoverable: privacy.discoverable,
      allow_message_requests: privacy.allowMessageRequests,
      default_story_audience: privacy.defaultStoryAudience
    };
  }
  function suggestionCard(person) {
    const connected = state.connections.includes(person.id);
    return `<article class="suggestion-card">${avatar(person)}<strong>${escape(person.name)}</strong><small>${person.age} · ${escape(person.city)}</small><button class="primary-button" data-action="hello" data-person-id="${person.id}">${connected ? "Hello sent ✓" : "Say hello ♡"}</button></article>`;
  }
  function renderSuggestions() {
    suggestions.innerHTML = communityPeople().slice(0, 3).map(person => `<div class="suggestion-person">${avatar(person, 90)}<span><strong>${escape(person.name)}</strong><small>${person.age} · ${escape(person.city)}</small></span></div>`).join("");
  }
  function storyButton(story, person, own = false) {
    return `<button class="story-item" data-action="open-story" data-story-id="${escape(story.id)}" data-person-id="${escape(person.id)}" aria-label="View ${escape(person.name)}'s story"><span class="story-avatar"><img src="${photo(story.image, 160)}" alt="" loading="lazy">${own ? '<span class="story-add">＋</span>' : ""}</span><span>${own ? "Your story" : escape(person.name.split(" ")[0])}</span></button>`;
  }
  function renderStories() {
    const ownStory = state.profile.storyImage ? { id: state.profile.storyId || "story-maya", image: state.profile.storyImage, type: state.profile.storyType, caption: state.profile.storyCaption } : { id: "story-maya", image: personFor(state.myId).image };
    const otherStories = (state.remote ? state.remoteStories : data.stories)
      .filter(story => !state.blockedIds.includes(story.person));
    return `<section class="content-card"><span class="section-kicker">LITTLE WINDOWS INTO THEIR DAY</span><div class="section-title-row"><h2 class="section-title">Stories <span>✿</span></h2><button class="subtle-button" data-action="create-story">＋ Add story</button></div><div class="story-list">${storyButton(ownStory, personFor(state.myId), true)}${otherStories.filter(story => story.person !== state.myId).map(story => storyButton(story, personFor(story.person))).join("")}</div></section>`;
  }
  function storyQueue() {
    const ownStory = state.profile.storyImage
      ? { id: state.profile.storyId || "story-maya", image: state.profile.storyImage, type: state.profile.storyType, caption: state.profile.storyCaption }
      : { id: "story-maya", image: personFor(state.myId).image };
    const otherStories = (state.remote ? state.remoteStories : data.stories)
      .filter(story => story.person !== state.myId && !state.blockedIds.includes(story.person));
    return [
      { story: ownStory, personId: state.myId, own: Boolean(state.profile.storyImage) },
      ...otherStories.map(story => ({ story, personId: story.person, own: false }))
    ];
  }
  function showStoryAt(index) {
    const item = currentStoryQueue[index];
    if (!item) return;
    currentStoryIndex = index;
    const person = personFor(item.personId);
    const storyMedia = item.story.type === "video"
      ? `<video class="story-media" src="${photo(item.story.image)}" playsinline webkit-playsinline controls></video>`
      : `<img class="story-media" src="${photo(item.story.image || person.image, 900)}" alt="">`;
    const nextButton = index < currentStoryQueue.length - 1
      ? '<button class="story-next-button" data-action="next-story" aria-label="View next story">›</button>'
      : "";
    showModal(`<div class="story-viewer">${storyMedia}<div class="story-viewer-content"><div class="story-viewer-head">${avatar(person)}<strong>${escape(person.name)}</strong><button data-action="close-modal" aria-label="Close story">×</button></div><div><p>${escape(item.story.caption || "")}</p>${item.own ? '<button data-action="delete-story">Delete my story</button>' : `<button data-action="reply-story" data-person-id="${escape(person.id)}">Send a kind reply</button>`}</div></div>${nextButton}</div>`, "Story");
  }
  function renderSuggestionPanel() {
    return `<section class="content-card"><div class="section-title-row"><div><span class="section-kicker">GOOD PEOPLE, WITH NO PRESSURE</span><h2 class="section-title">Profile suggestions</h2></div><button class="text-button" data-view="discover">Discover more ↗</button></div><div class="suggestion-grid">${communityPeople().slice(0, 3).map(suggestionCard).join("") || '<p class="empty-state">New people will appear here as they join Blend.</p>'}</div></section>`;
  }
  function renderPost(post) {
    const person = personFor(post.person);
    const liked = state.likes.includes(post.id);
    const saved = state.saved.includes(post.id);
    const comments = state.comments[post.id] || [];
    const likeCount = (post.likes || 0) + (!post.remote && liked ? 1 : 0);
    const commentCount = post.remote ? post.comments || 0 : (post.comments || 0) + comments.length;
    return `<article class="post-card" data-post="${escape(post.id)}"><div class="post-head">${avatar(person, 100)}<span class="post-author"><strong>${escape(person.name)}</strong><small>${escape(post.location || person.city)} · ${escape(post.time)}</small></span><button class="icon-plain" data-action="post-options" data-post-id="${escape(post.id)}" aria-label="Post options">•••</button></div>${post.image ? `<img class="post-image" src="${photo(post.image, 1000)}" alt="Photo shared by ${escape(person.name)}" loading="lazy">` : ""}<div class="post-actions"><button class="${liked ? "liked" : ""}" data-action="like" data-post-id="${escape(post.id)}" aria-label="${liked ? "Unlike" : "Like"} post">${liked ? "♥" : "♡"}</button><button data-action="comment" data-post-id="${escape(post.id)}" aria-label="Comment">◯</button><button data-action="share" data-post-id="${escape(post.id)}" aria-label="Share">↗</button><button class="post-more ${saved ? "saved" : ""}" data-action="save" data-post-id="${escape(post.id)}" aria-label="${saved ? "Unsave" : "Save"}">${saved ? "▣" : "▢"}</button></div><div class="post-copy"><strong class="like-count">${likeCount} appreciations</strong><p><strong>${escape(person.name.split(" ")[0])}</strong> ${escape(post.caption)}</p><div class="post-tags">${(post.tags || []).map(tag => `<button data-tag="${escape(tag)}">#${escape(tag.replace(/\s/g, ""))}</button>`).join("")}</div><button class="comments-link" data-action="comment" data-post-id="${escape(post.id)}">View all ${commentCount} notes</button><div class="comment-list">${comments.map(comment => `<p><strong>${escape(typeof comment === "string" ? state.profile.name.split(" ")[0] : comment.author)}</strong> ${escape(typeof comment === "string" ? comment : comment.content)}</p>`).join("")}</div><form class="quick-comment" data-comment-form="${escape(post.id)}"><input aria-label="Write a comment" placeholder="Leave a kind note…"><button type="submit" aria-label="Send comment">↑</button></form></div></article>`;
  }
  function renderHome() {
    let posts = [...allPosts()].reverse();
    if (state.filter === "Following") {
      const followed = new Set([state.myId, ...state.connections]);
      posts = posts.filter(post => followed.has(post.person));
    }
    return `${renderStories()}${renderSuggestionPanel()}<section class="feed-section"><div class="section-title-row"><div><span class="section-kicker">A GOOD PLACE TO BEGIN</span><h2 class="section-title">Your feed</h2></div><button class="subtle-button" data-action="create">＋ Create a post</button></div><div class="feed-tabs">${["For you", "Following"].map(filter => `<button class="${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>`).join("")}</div>${posts.length ? posts.map(renderPost).join("") : '<section class="content-card empty-state">Your Following feed will show posts from people you connect with.</section>'}</section>`;
  }
  function renderDiscover() {
    const query = state.query.trim().toLowerCase();
    const people = communityPeople().filter(person => !query || `${person.name} ${person.occupation} ${person.city} ${person.interests.join(" ")}`.toLowerCase().includes(query));
    return `<div class="view-intro"><span class="section-kicker">GOOD ENERGY, NO SWIPING RUSH</span><p>Meet people who might feel like your kind of people. Take your time.</p></div><label class="search-field" aria-label="Search people">⌕<input data-discover-search type="search" value="${escape(state.query)}" placeholder="Search names, interests, places…"></label><div class="discover-grid" style="margin-top:15px">${people.length ? people.map(person => `<article class="person-card">${avatar(person, 600).replace('class="avatar"', 'class="person-cover"')}<div class="person-card-body"><h3>${escape(person.name)}, ${person.age}</h3><small>${escape(person.occupation)} · ${escape(person.city)}</small><p>${escape(person.bio)}</p><div class="interest-list">${person.interests.map(interest => `<span>${escape(interest)}</span>`).join("")}</div><button class="primary-button" data-action="hello" data-person-id="${person.id}">${state.connections.includes(person.id) ? "Hello sent ✓" : "Say hello ♡"}</button><button class="text-button" data-action="member-options" data-person-id="${escape(person.id)}">Safety options</button></div></article>`).join("") : '<p class="empty-state">No profiles match yet. Try another search.</p>'}</div>${renderSuggestionPanel()}`;
  }
  function renderClips() {
    const clips = data.vignettes.filter(clip => !state.blockedIds.includes(clip.person));
    return `<div class="view-intro"><span class="section-kicker">SHORT MOMENTS, REAL PEOPLE</span><h2>Clips.</h2><p>Little films from people living their everyday stories.</p></div><div class="vignettes-list">${clips.map((clip, index) => {
      const person = personFor(clip.person);
      return `<article class="vignette-card" data-clip="${clip.id}"><img class="vignette-poster" src="${photo(clip.poster, 600)}" alt="" loading="lazy"><video class="vignette-video" src="${escape(clip.video)}" poster="${photo(clip.poster, 600)}" muted playsinline webkit-playsinline preload="none" aria-label="${escape(clip.caption)}"></video><div class="vignette-gradient"></div><div class="vignette-topline"><span>✳ A LITTLE FILM</span><span>UP TO 1 MIN · ${String(index + 1).padStart(2, "0")}</span></div><div class="vignette-copy"><button class="vignette-author" data-person="${person.id}">${avatar(person, 80)}<span><strong>${escape(person.name)}</strong><small>${escape(person.occupation)}</small></span></button><p>${escape(clip.caption)}</p><div>${clip.tags.map(tag => `#${escape(tag.replace(/\s/g, ""))} `).join("")}</div></div><div class="vignette-actions"><button class="vignette-action" data-action="toggle-clip" aria-label="Play or pause Clip"><span>▷</span><small>Play</small></button><button class="vignette-action" data-action="share" data-post-id="${clip.id}" aria-label="Share Clip"><span>↗</span><small>Share</small></button></div></article>`;
    }).join("")}</div>`;
  }
  function renderProfile() {
    const ownPosts = state.posts.filter(post => post.person === state.myId);
    const followerPeople = state.remote ? state.followers.map(personFor) : [personFor("sofia"), personFor("dev"), personFor("lena")];
    return `<section class="content-card"><div class="profile-cover"></div><div class="profile-summary">${avatar(personFor(state.myId), 200)}<button class="subtle-button" data-action="edit-profile" style="float:right;margin-top:8px">Edit profile</button><h2>${escape(state.profile.name)}${state.profile.age ? `, ${escape(state.profile.age)}` : ""}</h2><small>${escape(state.profile.occupation)} · ${escape(state.profile.city)}</small><p>${escape(state.profile.bio)}</p><div class="profile-stats"><button class="profile-stat" data-action="show-people" data-list="followers"><strong>${followerPeople.length}</strong><span>Followers</span></button><button class="profile-stat" data-action="show-people" data-list="following"><strong>${state.connections.length}</strong><span>Following</span></button><button class="profile-stat"><strong>${ownPosts.length}</strong><span>Moments</span></button></div></div></section>${renderSuggestionPanel()}<section class="content-card"><div class="section-title-row"><div><span class="section-kicker">YOUR LITTLE COLLECTION</span><h2 class="section-title">Your moments</h2></div><button class="subtle-button" data-action="create">＋ Add a moment</button></div>${ownPosts.length ? `<div class="profile-tiles">${ownPosts.map(post => `<img class="profile-tile" src="${photo(post.image, 400)}" alt="${escape(post.caption)}">`).join("")}</div>` : '<p class="empty-state">Your first moment can start right here.</p>'}</section>`;
  }
  function messagesFor(personId) {
    if (state.messages[personId]?.length) return state.messages[personId];
    return state.remote ? [] : ["Hi! I liked what you shared about finding joy in the little things.", "Thank you! That really made my day. What have you been enjoying lately?"];
  }
  function renderMessages() {
    const people = communityPeople();
    if (!people.length) return '<div class="view-intro"><span class="section-kicker">KIND WORDS, AT YOUR OWN PACE</span></div><section class="content-card empty-state">Messaging will be ready when more people join Blend.</section>';
    const selected = people.find(person => person.id === state.selectedPerson) || people[0];
    state.selectedPerson = selected.id;
    const conversationPeople = state.remote ? people.filter(person => state.conversationIds[person.id]) : people;
    return `<div class="view-intro"><span class="section-kicker">KIND WORDS, AT YOUR OWN PACE</span></div><div class="messages-layout"><nav class="conversation-list" aria-label="Conversations">${conversationPeople.map(person => { const messages = messagesFor(person.id); const last = messages[messages.length - 1]; return `<button class="conversation-item ${person.id === selected.id ? "active" : ""}" data-action="select-conversation" data-person-id="${person.id}">${avatar(person, 90)}<span><strong>${escape(person.name)}</strong><small>${escape(typeof last === "string" ? last : last?.content || "Say hello")}</small></span></button>`; }).join("") || '<p class="empty-state">Choose a profile and send a kind hello to start a conversation.</p>'}</nav><section class="thread-view"><div class="thread-heading">${avatar(selected, 90)}<strong>${escape(selected.name)}</strong></div><div class="thread-messages">${messagesFor(selected.id).map((message, index) => `<div class="bubble ${typeof message === "string" ? (index % 2 ? "mine" : "theirs") : (message.mine ? "mine" : "theirs")}">${escape(typeof message === "string" ? message : message.content)}</div>`).join("")}</div><form class="message-composer" data-message-form="${selected.id}"><input aria-label="Write a message" placeholder="Write a kind note…"><button type="submit" aria-label="Send message">↑</button></form></section></div>`;
  }
  function renderSaved() {
    const savedPosts = allPosts().filter(post => state.saved.includes(post.id));
    return `<div class="view-intro"><h2>Your saved moments.</h2><p>Posts you have tucked away for later.</p></div>${savedPosts.length ? savedPosts.map(renderPost).join("") : '<section class="content-card empty-state">No saved posts yet. Tap the bookmark on a post to keep it here.</section>'}`;
  }
  function render() {
    const views = { home: renderHome, discover: renderDiscover, vignettes: renderClips, profile: renderProfile, messages: renderMessages, saved: renderSaved };
    const titles = { home: "Your little corner of the world", discover: "Discover", vignettes: "Clips", profile: "This is your story", messages: "Messages", saved: "Saved" };
    const pageTitle = document.querySelector("#page-title");
    const compactHeader = ["vignettes", "discover", "messages", "saved"].includes(state.view);
    pageTitle.hidden = compactHeader;
    document.querySelector(".topbar").classList.toggle("compact-view", compactHeader);
    pageTitle.innerHTML = `${escape(titles[state.view] || titles.home)}<span>.</span>`;
    document.querySelector("#eyebrow").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
    document.querySelector(".top-avatar img").src = profileImage();
    document.querySelector(".top-avatar img").alt = `${state.profile.name}'s profile`;
    document.querySelector("#profile-greeting").textContent = `Hey, ${state.profile.name.split(/\s+/)[0]}`;
    document.querySelector('[data-action="account"].settings-link').innerHTML = `<span>♙</span> ${backend.isAuthenticated ? "Account & sign out" : "Account & sign in"}`;
    document.querySelectorAll("[data-intent]").forEach(button => button.classList.toggle("selected", button.dataset.intent === state.intent));
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
    root.innerHTML = (views[state.view] || renderHome)();
    renderSuggestions();
    if (state.view === "vignettes") observeClips();
  }
  let clipObserver;
  function observeClips() {
    clipObserver?.disconnect();
    const cards = [...root.querySelectorAll(".vignette-card")];
    const pauseOthers = active => cards.forEach(card => { if (card !== active) card.querySelector("video").pause(); });
    if (!("IntersectionObserver" in window)) return;
    clipObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      const video = entry.target.querySelector("video");
      if (entry.isIntersecting && entry.intersectionRatio > .6) {
        pauseOthers(entry.target);
        video.play().catch(error => { if (!["NotAllowedError", "AbortError"].includes(error.name)) console.warn("Could not play Clip.", error); });
      } else video.pause();
    }), { threshold: [.6] });
    cards.forEach(card => {
      const video = card.querySelector("video");
      video.addEventListener("timeupdate", () => { if (video.currentTime >= 60) { video.pause(); video.currentTime = 60; } });
      clipObserver.observe(card);
    });
  }
  function showPeople(which) {
    const people = which === "followers"
      ? (state.remote ? state.followers : ["sofia", "dev", "lena"]).map(personFor)
      : state.connections.map(personFor);
    showModal(`<span class="section-kicker">YOUR BLEND COMMUNITY</span><h2>${which === "followers" ? "Followers" : "Following"} · ${people.length}</h2>${people.length ? people.map(person => `<div class="profile-person-row">${avatar(person)}<span><strong>${escape(person.name)}</strong><small>${escape(person.occupation)} · ${escape(person.city)}</small></span></div>`).join("") : '<p class="empty-state">Your list will grow as you connect.</p>'}`, which);
  }
  function createPostForm() {
    return `<span class="section-kicker">A MOMENT FROM YOUR WORLD</span><h2>Share what feels like you.</h2><p class="modal-description">Add media and a caption for your moment.</p><form id="create-form" class="create-form"><label class="media-picker"><span>Add media</span><input name="media" type="file" accept="image/*" capture="environment"></label><img class="post-preview" hidden alt="Photo preview"><button type="button" class="subtle-button" data-action="toggle-location">＋ Add location</button><label class="location-field" hidden>Place or city<input name="location" placeholder="Add a place or city"></label><label>Your caption<textarea name="caption" required maxlength="500" placeholder="A little piece of your day…"></textarea></label><label>Who gets to see this?<select name="audience"><option>Everyone</option><option>Connections only</option><option>Only me</option></select></label><p class="upload-error" hidden></p><button class="primary-button" type="submit">Share my moment ↗</button></form>`;
  }
  function openCreateStory() {
    const audience = state.privacy.defaultStoryAudience || "public";
    showModal(`<span class="section-kicker">LITTLE WINDOWS INTO YOUR DAY</span><h2>Add to your story.</h2><form id="story-form" class="create-form"><label>Choose a photo or video<input name="story" type="file" accept="image/*,video/*" capture="environment"></label><label>Say a little something<textarea name="caption" maxlength="180" placeholder="A little moment from today…"></textarea></label><label>Who can see this story?<select name="audience"><option value="public" ${audience === "public" ? "selected" : ""}>Everyone</option><option value="followers" ${audience === "followers" ? "selected" : ""}>My followers</option><option value="private" ${audience === "private" ? "selected" : ""}>Only me</option></select></label><p class="upload-error" hidden></p><button type="submit" class="primary-button">Share my story ✿</button></form>`, "Create a story");
  }
  async function resizeImage(file, max = 1100) {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
    let image;
    let bitmap = false;
    if (window.createImageBitmap) { image = await window.createImageBitmap(file); bitmap = true; }
    else {
      const url = URL.createObjectURL(file);
      try { image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Could not read this photo.")); img.src = url; }); }
      finally { URL.revokeObjectURL(url); }
    }
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (bitmap) image.close?.();
    return canvas.toDataURL("image/jpeg", .84);
  }
  function imageFromFile(file, allowVideo = false) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      const validType = file.type.startsWith("image/") || (allowVideo && file.type.startsWith("video/"));
      if (!validType) return reject(new Error(allowVideo ? "Choose a photo or video for your story." : "Choose an image file."));
      if (file.size > (file.type.startsWith("video/") ? 5 : 10) * 1024 * 1024) return reject(new Error(file.type.startsWith("video/") ? "Choose a video smaller than 5 MB." : "Choose a photo smaller than 10 MB."));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read this photo."));
      reader.readAsDataURL(file);
    });
  }
  async function shareLink(url) {
    try {
      if (navigator.share) await navigator.share({ title: "Blend — where your worlds meet", url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); toast("Link copied to your clipboard."); }
      else toast("Copy the page address from your browser to share.");
    } catch (error) {
      if (error.name !== "AbortError") { console.warn("Could not share link.", error); toast("Could not open sharing on this device."); }
    }
  }

  document.addEventListener("click", async event => {
    const button = event.target.closest("button,[data-dismiss]");
    if (!button) return;
    if (button.matches("[data-dismiss='modal']")) { closeModal(); return; }
    if (button.dataset.view) { state.view = button.dataset.view; state.query = ""; render(); window.scrollTo(0, 0); return; }
    if (button.dataset.filter) { state.filter = button.dataset.filter; render(); return; }
    if (button.dataset.action === "close-modal") { closeModal(); return; }
    if (button.dataset.action === "account") { state.authMode = "login"; accountModal(); return; }
    if (button.dataset.action === "privacy") { privacyModal(); return; }
    if (button.dataset.action === "auth-mode") { state.authMode = button.dataset.mode; accountModal(); return; }
    if (button.dataset.action === "sign-out") {
      try {
        await backend.signOut();
        state.remote = false;
        window.clearTimeout(state.mediaRefreshTimer);
        state.myId = "maya";
        state.followers = [];
        state.conversationIds = {};
        state.remoteStories = [];
        data.people = [...demoPeople];
        state.remoteProfiles = [];
        state.profile = read("profile", { name: "Maya Chen", age: "28", occupation: "Product designer", city: "Brooklyn", bio: "", image: "" });
        state.posts = read("posts", []);
        state.likes = read("likes", []);
        state.saved = read("saved", []);
        state.connections = read("connections", []);
        state.comments = read("comments", {});
        state.messages = read("messages", {});
        state.intent = read("intent", "A real connection");
        state.privacy = read("privacy", { discoverable: true, allowMessageRequests: true, defaultStoryAudience: "public" });
        state.blockedIds = read("blocked", []);
        state.view = "home";
        closeModal(); render(); toast("You have signed out.");
      } catch (error) { accountModal(error.message); }
      return;
    }
    if (button.dataset.action === "create") { showModal(createPostForm(), "Create a post"); return; }
    if (button.dataset.action === "create-story") { openCreateStory(); return; }
    if (button.dataset.action === "edit-profile") {
      showModal(`<span class="section-kicker">LET YOUR PROFILE FEEL LIKE YOU</span><h2>Edit your profile.</h2><form id="profile-form" class="create-form"><label>Name<input name="name" required value="${escape(state.profile.name)}"></label><label>Age<input name="age" type="number" min="18" max="${state.remote ? 120 : 99}" value="${escape(state.profile.age)}"></label><label>Profession<input name="occupation" value="${escape(state.profile.occupation)}"></label><label>City<input name="city" value="${escape(state.profile.city)}"></label><label>A little about you<textarea name="bio" maxlength="${state.remote ? 500 : 280}">${escape(state.profile.bio)}</textarea></label><label>Profile photo<input name="photo" type="file" accept="image/*" capture="user"></label><p class="upload-error" hidden></p><button class="primary-button" type="submit">Save my details ✓</button></form>`, "Edit your profile"); return;
    }
    if (button.dataset.action === "toggle-location") { const label = modalRoot.querySelector(".location-field"); label.hidden = !label.hidden; if (!label.hidden) label.querySelector("input").focus(); return; }
    if (button.dataset.action === "hello") {
      const id = button.dataset.personId;
      if (state.connections.includes(id)) { toast("You have already sent a hello."); return; }
      try {
        if (state.remote && isRemoteId(id)) {
          const conversation = await backend.startConversation(id);
          await backend.setFollowing(id, true);
          state.conversationIds[id] = conversation.id;
          state.messages[id] ||= [];
        }
      }
      catch (error) { toast(error.message); return; }
      state.connections.push(id); write("connections", state.connections); render(); toast(`A friendly hello is on its way to ${personFor(id).name.split(" ")[0]}.`); return;
    }
    if (button.dataset.action === "like") {
      const id = button.dataset.postId;
      const liked = !state.likes.includes(id);
      try { if (state.remote && isRemoteId(id)) await backend.setLike(id, liked); }
      catch (error) { toast(error.message); return; }
      state.likes = liked ? [...state.likes, id] : state.likes.filter(item => item !== id);
      write("likes", state.likes); render(); return;
    }
    if (button.dataset.action === "save") {
      const id = button.dataset.postId;
      const saved = !state.saved.includes(id);
      try { if (state.remote && isRemoteId(id)) await backend.setSaved(id, saved); }
      catch (error) { toast(error.message); return; }
      state.saved = saved ? [...state.saved, id] : state.saved.filter(item => item !== id);
      write("saved", state.saved); render(); toast(state.saved.includes(id) ? "Saved to your moments." : "Removed from saved moments."); return;
    }
    if (button.dataset.action === "comment") { root.querySelector(`[data-comment-form="${CSS.escape(button.dataset.postId)}"] input`)?.focus(); return; }
    if (button.dataset.action === "share") { await shareLink(location.href.split("#")[0] + `#${encodeURIComponent(button.dataset.postId)}`); return; }
    if (button.dataset.action === "post-options") {
      const id = button.dataset.postId;
      const ownPost = state.posts.some(post => post.id === id);
      const post = allPosts().find(item => item.id === id);
      const authorId = post?.person || "";
      showModal(`<span class="section-kicker">A LITTLE NOTE</span><h2>Post options</h2><button class="primary-button" data-action="save" data-post-id="${escape(id)}">Save or remove saved post</button>${ownPost ? `<button class="text-button" data-action="delete-post" data-post-id="${escape(id)}" style="margin:10px 0;color:#a34f58">Delete my post</button>` : `<button class="text-button" data-action="report-post" data-post-id="${escape(id)}" style="margin-top:10px">Report this post</button><button class="text-button" data-action="confirm-block" data-person-id="${escape(authorId)}" style="margin-top:10px">Block ${escape(personFor(authorId).name)}</button>`}<button class="text-button" data-action="close-modal" style="margin-top:10px">Close</button>`, "Post options"); return;
    }
    if (button.dataset.action === "member-options") { memberOptionsModal(button.dataset.personId); return; }
    if (button.dataset.action === "report-profile") { reportModal("profile", button.dataset.personId); return; }
    if (button.dataset.action === "report-post") {
      const post = allPosts().find(item => item.id === button.dataset.postId);
      if (post) reportModal("post", post.id);
      return;
    }
    if (button.dataset.action === "confirm-block") { blockConfirmModal(button.dataset.personId); return; }
    if (button.dataset.action === "block-member") {
      const id = button.dataset.personId;
      try {
        if (state.remote) {
          await backend.blockMember(id);
          closeModal();
          await refreshRemoteState();
        } else {
          state.blockedIds = [...new Set([...state.blockedIds, id])];
          state.connections = state.connections.filter(personId => personId !== id);
          state.followers = state.followers.filter(personId => personId !== id);
          delete state.messages[id]; delete state.conversationIds[id];
          write("blocked", state.blockedIds); write("connections", state.connections);
          write("followers", state.followers); write("messages", state.messages);
          if (state.selectedPerson === id) state.selectedPerson = communityPeople()[0]?.id || "";
          closeModal(); render();
        }
        toast(`${personFor(id).name} has been blocked.`);
      } catch (error) { toast(error.message || "Could not block this account."); }
      return;
    }
    if (button.dataset.action === "unblock-member") {
      const id = button.dataset.personId;
      const displayName = personFor(id).name;
      try {
        if (state.remote) {
          await backend.unblockMember(id);
          closeModal();
          await refreshRemoteState();
        } else {
          state.blockedIds = state.blockedIds.filter(personId => personId !== id);
          write("blocked", state.blockedIds); closeModal(); render();
        }
        toast(`${displayName} has been unblocked.`);
      } catch (error) { toast(error.message || "Could not unblock this account."); }
      return;
    }
    if (button.dataset.action === "delete-post") {
      const id = button.dataset.postId;
      try { if (state.remote && isRemoteId(id)) await backend.deletePost(id); }
      catch (error) { toast(error.message); return; }
      state.posts = state.posts.filter(post => post.id !== id);
      write("posts", state.posts); closeModal(); render(); toast("Your post has been deleted."); return;
    }
    if (button.dataset.action === "open-story") {
      currentStoryQueue = storyQueue();
      currentStoryIndex = currentStoryQueue.findIndex(item => item.story.id === button.dataset.storyId && item.personId === button.dataset.personId);
      if (currentStoryIndex < 0) return;
      showStoryAt(currentStoryIndex); return;
    }
    if (button.dataset.action === "next-story") { showStoryAt(currentStoryIndex + 1); return; }
    if (button.dataset.action === "delete-story") {
      try {
        if (state.remote && isRemoteId(state.profile.storyId)) await backend.deleteStory(state.profile.storyId);
      } catch (error) { toast(error.message); return; }
      delete state.profile.storyImage;
      delete state.profile.storyCaption;
      delete state.profile.storyType;
      delete state.profile.storyId;
      write("profile", state.profile); closeModal(); render(); toast("Your story has been deleted."); return;
    }
    if (button.dataset.action === "reply-story") {
      const id = button.dataset.personId;
      try {
        if (state.remote && isRemoteId(id)) {
          const conversation = await backend.startConversation(id);
          state.conversationIds[id] = conversation.id;
          state.messages[id] ||= [];
        }
        closeModal(); state.selectedPerson = id; state.view = "messages"; render(); toast(`Your conversation with ${personFor(id).name} is ready.`);
      } catch (error) { toast(error.message); }
      return;
    }
    if (button.dataset.action === "show-people") { showPeople(button.dataset.list); return; }
    if (button.dataset.action === "select-conversation") { state.selectedPerson = button.dataset.personId; render(); return; }
    if (button.dataset.action === "toggle-clip") {
      const video = button.closest(".vignette-card").querySelector("video");
      if (video.paused) video.play().catch(error => { if (!["NotAllowedError", "AbortError"].includes(error.name)) console.warn("Could not play Clip.", error); });
      else video.pause();
      button.querySelector("span").textContent = video.paused ? "▷" : "Ⅱ";
    }
    if (button.dataset.action === "search") {
      showModal(`<span class="section-kicker">FIND YOUR PEOPLE</span><h2>Search Blend.</h2><label class="search-field">⌕<input data-global-search type="search" placeholder="Names, interests, places…"></label><div class="search-suggestions"><p>Try a name like Sofia or an interest like travel.</p></div>`, "Search");
      modalRoot.querySelector("[data-global-search]").focus(); return;
    }
    if (button.dataset.action === "notifications") { showModal(`<span class="section-kicker">A LITTLE GOOD NEWS</span><h2>Your notifications.</h2><div class="profile-person-row">${avatar(personFor("sofia"))}<span><strong>Sofia shared a moment</strong><small>18 minutes ago</small></span></div><div class="profile-person-row">${avatar(personFor("dev"))}<span><strong>Dev is open to a new hello</strong><small>Earlier today</small></span></div>`, "Notifications"); }
  });

  document.addEventListener("input", event => {
    if (event.target.matches("[data-discover-search]")) {
      const position = event.target.selectionStart;
      state.query = event.target.value;
      render();
      const input = root.querySelector("[data-discover-search]");
      input.focus();
      input.setSelectionRange(position, position);
    }
    if (event.target.matches("[data-global-search]")) {
      const query = event.target.value.trim().toLowerCase();
      const matches = communityPeople().filter(person => `${person.name} ${person.occupation} ${person.city} ${person.interests.join(" ")}`.toLowerCase().includes(query));
      modalRoot.querySelector(".search-suggestions").innerHTML = query ? matches.map(person => `<div class="profile-person-row">${avatar(person)}<span><strong>${escape(person.name)}</strong><small>${escape(person.occupation)} · ${escape(person.city)}</small></span><button class="text-button" data-action="hello" data-person-id="${person.id}">Say hello</button></div>`).join("") || "<p>No profiles match yet.</p>" : "<p>Try a name like Sofia or an interest like travel.</p>";
    }
  });

  document.addEventListener("change", async event => {
    if (!event.target.matches('input[type="file"]')) return;
    const input = event.target;
    if (input.name === "media") {
      const preview = modalRoot.querySelector(".post-preview");
      if (!input.files[0]) { preview.hidden = true; return; }
      try { preview.src = await resizeImage(input.files[0]); preview.hidden = false; }
      catch (error) { const message = modalRoot.querySelector(".upload-error"); message.textContent = error.message; message.hidden = false; input.value = ""; }
    }
  });

  document.addEventListener("submit", async event => {
    const form = event.target;
    if (form.id === "report-form") {
      event.preventDefault();
      const error = form.querySelector(".upload-error");
      const submit = form.querySelector('[type="submit"]');
      error.hidden = true; submit.disabled = true;
      try {
        await backend.createReport({
          target_type: form.dataset.targetType,
          target_id: form.dataset.targetId,
          reason: form.elements.reason.value,
          details: form.elements.details.value.trim()
        });
        closeModal(); toast("Thanks. Your report has been recorded.");
      } catch (exception) {
        error.textContent = exception.message || "Could not send your report.";
        error.hidden = false;
      } finally { if (submit.isConnected) submit.disabled = false; }
      return;
    }
    if (form.id === "privacy-form") {
      event.preventDefault();
      const error = form.querySelector(".upload-error");
      const submit = form.querySelector('[type="submit"]');
      const privacy = {
        discoverable: form.elements.discoverable.value === "true",
        allowMessageRequests: form.elements.allow_message_requests.value === "true",
        defaultStoryAudience: form.elements.default_story_audience.value
      };
      error.hidden = true; submit.disabled = true;
      try {
        if (state.remote) {
          const saved = await backend.updateProfile(profileUpdatePayload(state.profile, privacy));
          privacy.discoverable = saved.discoverable !== false;
          privacy.allowMessageRequests = saved.allow_message_requests !== false;
          privacy.defaultStoryAudience = saved.default_story_audience || "public";
        }
        state.privacy = privacy;
        write("privacy", state.privacy);
        closeModal(); render(); toast("Your privacy settings have been saved.");
      } catch (exception) {
        error.textContent = exception.message || "Could not save your privacy settings.";
        error.hidden = false;
      } finally { if (submit.isConnected) submit.disabled = false; }
      return;
    }
    if (form.id === "account-form") {
      event.preventDefault();
      const error = form.querySelector(".upload-error");
      const submit = form.querySelector('[type="submit"]');
      error.hidden = true; submit.disabled = true;
      try {
        const details = {
          email: form.elements.email.value.trim(),
          password: form.elements.password.value
        };
        if (state.authMode === "signup") details.display_name = form.elements.display_name.value.trim();
        const result = await backend[state.authMode === "signup" ? "signUp" : "signIn"](details);
        if (!result.access_token) {
          closeModal();
          toast("Check your email to confirm your Blend account, then sign in.");
          return;
        }
        await refreshRemoteState();
        state.view = "home"; closeModal(); render();
        toast(state.authMode === "signup" ? "Your Blend account is ready." : "Welcome back to Blend.");
      } catch (exception) {
        error.textContent = exception.message || "Could not connect your account.";
        error.hidden = false;
      } finally {
        if (submit.isConnected) submit.disabled = false;
      }
      return;
    }
    if (form.id === "create-form") {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const error = form.querySelector(".upload-error");
      submit.disabled = true; error.hidden = true;
      try {
        const caption = form.elements.caption.value.trim();
        if (!caption) throw new Error("Add a caption before sharing your post.");
        let image = "";
        if (form.elements.media.files[0]) image = await resizeImage(form.elements.media.files[0]);
        if (state.remote) {
          let mediaPath = "";
          let mediaUrl = "";
          if (image) {
            const uploaded = await backend.uploadMedia(image);
            mediaPath = uploaded.path;
            mediaUrl = uploaded.url;
          }
          const remotePost = await backend.createPost({
            caption,
            media_path: mediaPath,
            location: form.elements.location.value.trim(),
            audience: form.elements.audience.value
          });
          state.posts.push({ ...postFromRemote(remotePost), image: mediaUrl });
        } else {
          const post = { id: `local-${Date.now()}`, person: state.myId, image, caption, location: form.elements.location.value.trim(), audience: form.elements.audience.value, likes: 0, comments: 0, time: "Just now", tags: [] };
          state.posts.unshift(post); write("posts", state.posts);
        }
        closeModal(); state.view = "home"; render(); toast("Your moment has been shared.");
      } catch (exception) { error.textContent = exception.message || "Could not share this moment."; error.hidden = false; }
      finally { if (submit.isConnected) submit.disabled = false; }
    }
    if (form.id === "story-form") {
      event.preventDefault();
      const error = form.querySelector(".upload-error");
      try {
        const mediaFile = form.elements.story.files[0];
        let storyImage = await imageFromFile(mediaFile, true);
        if (state.remote) {
          if (!storyImage) throw new Error("Choose a photo or video for your story.");
          const uploaded = await backend.uploadMedia(storyImage);
          const story = await backend.createStory({
            media_path: uploaded.path,
            media_type: uploaded.type,
            caption: form.elements.caption.value.trim(),
            audience: form.elements.audience.value
          });
          state.profile.storyId = story.id;
          state.profile.storyImage = uploaded.url;
          state.profile.storyPath = story.media_path;
          state.profile.storyType = story.media_type;
          state.profile.storyCaption = story.caption;
          closeModal(); render(); toast("Your story is ready to view.");
          return;
        }
        if (storyImage) {
          state.profile.storyImage = storyImage;
          state.profile.storyType = mediaFile.type.startsWith("video/") ? "video" : "image";
        }
        state.profile.storyCaption = form.elements.caption.value.trim();
        state.profile.storyAudience = form.elements.audience.value;
        write("profile", state.profile); closeModal(); render(); toast("Your story is ready to view.");
      } catch (exception) { error.textContent = exception.message || "Could not add this story."; error.hidden = false; }
    }
    if (form.id === "profile-form") {
      event.preventDefault();
      const error = form.querySelector(".upload-error");
      try {
        const formData = new FormData(form);
        const updatedProfile = {
          name: String(formData.get("name")).trim(),
          age: String(formData.get("age") || ""),
          occupation: String(formData.get("occupation") || "").trim(),
          city: String(formData.get("city") || "").trim(),
          bio: String(formData.get("bio") || "").trim()
        };
        if (form.elements.photo.files[0]) {
          let image = await resizeImage(form.elements.photo.files[0], 600);
          if (state.remote) {
            const uploaded = await backend.uploadMedia(image);
            image = uploaded.url;
            updatedProfile.avatarPath = uploaded.path;
          }
          updatedProfile.image = image;
        }
        if (state.remote) {
          const savedProfile = await backend.updateProfile({
            display_name: updatedProfile.name,
            age: updatedProfile.age,
            occupation: updatedProfile.occupation,
            city: updatedProfile.city,
            bio: updatedProfile.bio,
            avatar_path: updatedProfile.avatarPath || state.profile.avatarPath,
            intent: state.intent,
            discoverable: state.privacy.discoverable,
            allow_message_requests: state.privacy.allowMessageRequests,
            default_story_audience: state.privacy.defaultStoryAudience
          });
          Object.assign(updatedProfile, {
            age: savedProfile.age || "",
            image: savedProfile.avatar_url || "",
            avatarPath: savedProfile.avatar_path || ""
          });
        }
        Object.assign(state.profile, updatedProfile);
        const me = data.people.find(person => person.id === state.myId);
        if (me) Object.assign(me, { name: state.profile.name, age: state.profile.age, occupation: state.profile.occupation, city: state.profile.city, bio: state.profile.bio, image: state.profile.image });
        write("profile", state.profile); closeModal(); render(); toast("Your profile has been updated.");
      } catch (exception) { error.textContent = exception.message || "Could not update your profile."; error.hidden = false; }
    }
    if (form.matches("[data-comment-form]")) {
      event.preventDefault();
      const comment = form.querySelector("input").value.trim();
      if (!comment) return;
      const id = form.dataset.commentForm;
      try {
        if (state.remote && isRemoteId(id)) await backend.createComment({ post_id: id, content: comment });
      } catch (error) { toast(error.message); return; }
      state.comments[id] = [...(state.comments[id] || []), state.remote ? { content: comment, author: state.profile.name.split(" ")[0] } : comment];
      write("comments", state.comments); render();
    }
    if (form.matches("[data-message-form]")) {
      event.preventDefault();
      const input = form.querySelector("input");
      const message = input.value.trim();
      if (!message) return;
      const id = form.dataset.messageForm;
      try {
        if (state.remote && isRemoteId(id)) {
          let conversationId = state.conversationIds[id];
          if (!conversationId) {
            const conversation = await backend.startConversation(id);
            conversationId = conversation.id;
            state.conversationIds[id] = conversationId;
          }
          await backend.sendMessage({ conversation_id: conversationId, content: message });
        }
      } catch (error) { toast(error.message); return; }
      state.messages[id] = [...messagesFor(id), state.remote ? { content: message, mine: true } : message];
      write("messages", state.messages); render();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
    else if (event.key === "ArrowRight" && !event.repeat && modalRoot.querySelector(".story-viewer")) {
      event.preventDefault();
      showStoryAt(currentStoryIndex + 1);
    }
  });
  document.querySelectorAll("[data-intent]").forEach(button => {
    button.classList.toggle("selected", button.dataset.intent === state.intent);
    button.addEventListener("click", async () => {
      try {
        if (state.remote) {
          await backend.updateProfile(profileUpdatePayload(state.profile, state.privacy, button.dataset.intent));
        }
        state.intent = button.dataset.intent;
        write("intent", state.intent);
        if (state.remote) state.profile.intent = state.intent;
        document.querySelectorAll("[data-intent]").forEach(option => option.classList.toggle("selected", option === button));
        toast(`Your check-in is set to “${state.intent}”.`);
      } catch (error) { toast(error.message); }
    });
  });
  render();
  if (backend.isAuthenticated) {
    refreshRemoteState().catch(error => {
      console.error("Could not restore the signed-in Blend account.", error);
      toast(error.message || "Could not load your account.");
    });
  }
})();
