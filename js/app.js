(() => {
  "use strict";

  const data = window.BLEND_DATA;
  const root = document.querySelector("#view-root");
  const modalRoot = document.querySelector("#modal-root");
  const suggestions = document.querySelector("#suggestion-list");
  const storeKey = "blend.rebuilt.";
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(storeKey + key)) ?? fallback; }
    catch (error) { console.warn(`Could not read ${key} from local storage.`, error); return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(storeKey + key, JSON.stringify(value)); }
    catch (error) { console.error(`Could not save ${key} to local storage.`, error); toast("Could not save this change on your device."); }
  };
  const state = {
    view: "home",
    filter: "For you",
    query: "",
    selectedPerson: "sofia",
    profile: read("profile", { name: "Maya Chen", age: "28", occupation: "Product designer", city: "Brooklyn", bio: "Designing a life with room for Sunday markets, overwatered plants, and people who make anywhere feel like home.", image: "" }),
    posts: read("posts", []),
    likes: read("likes", []),
    saved: read("saved", []),
    connections: read("connections", []),
    comments: read("comments", {}),
    messages: read("messages", {}),
    intent: read("intent", "A real connection")
  };

  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const personFor = id => data.people.find(person => person.id === id) || data.people[0];
  const profileImage = () => state.profile.image || photo(personFor("maya").image, 160);
  function photo(source, width = 640) {
    if (/^(https?:|data:|blob:)/i.test(source || "")) return escape(source);
    return `https://images.unsplash.com/${String(source || "").startsWith("photo-") ? source : `photo-${source}`}?auto=format&fit=crop&w=${width}&q=82`;
  }
  function avatar(person, size = 120) {
    const src = person.id === "maya" ? profileImage() : photo(person.image, size);
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
  function allPosts() { return [...state.posts, ...data.posts]; }
  function suggestionCard(person) {
    const connected = state.connections.includes(person.id);
    return `<article class="suggestion-card">${avatar(person)}<strong>${escape(person.name)}</strong><small>${person.age} · ${escape(person.city)}</small><button class="primary-button" data-action="hello" data-person-id="${person.id}">${connected ? "Hello sent ✓" : "Say hello ♡"}</button></article>`;
  }
  function renderSuggestions() {
    suggestions.innerHTML = data.people.filter(person => person.id !== "maya").slice(0, 3).map(person => `<div class="suggestion-person">${avatar(person, 90)}<span><strong>${escape(person.name)}</strong><small>${person.age} · ${escape(person.city)}</small></span></div>`).join("");
  }
  function storyButton(story, person, own = false) {
    return `<button class="story-item" data-action="open-story" data-story-id="${escape(story.id)}" data-person-id="${escape(person.id)}" aria-label="View ${escape(person.name)}'s story"><span class="story-avatar"><img src="${photo(story.image, 160)}" alt="" loading="lazy">${own ? '<span class="story-add">＋</span>' : ""}</span><span>${own ? "Your story" : escape(person.name.split(" ")[0])}</span></button>`;
  }
  function renderStories() {
    const mayaStory = state.profile.storyImage ? { id: "story-maya", image: state.profile.storyImage } : { id: "story-maya", image: personFor("maya").image };
    return `<section class="content-card"><span class="section-kicker">LITTLE WINDOWS INTO THEIR DAY</span><div class="section-title-row"><h2 class="section-title">Stories <span>✿</span></h2><button class="subtle-button" data-action="create-story">＋ Add story</button></div><div class="story-list">${storyButton(mayaStory, personFor("maya"), true)}${data.stories.map(story => storyButton(story, personFor(story.person))).join("")}</div></section>`;
  }
  function renderSuggestionPanel() {
    return `<section class="content-card"><div class="section-title-row"><div><span class="section-kicker">GOOD PEOPLE, WITH NO PRESSURE</span><h2 class="section-title">Profile suggestions</h2></div><button class="text-button" data-view="discover">Discover more ↗</button></div><div class="suggestion-grid">${data.people.filter(person => person.id !== "maya").slice(0, 3).map(suggestionCard).join("")}</div></section>`;
  }
  function renderPost(post) {
    const person = personFor(post.person);
    const liked = state.likes.includes(post.id);
    const saved = state.saved.includes(post.id);
    const comments = state.comments[post.id] || [];
    return `<article class="post-card" data-post="${escape(post.id)}"><div class="post-head">${avatar(person, 100)}<span class="post-author"><strong>${escape(person.name)}</strong><small>${escape(post.location || person.city)} · ${escape(post.time)}</small></span><button class="icon-plain" data-action="post-options" data-post-id="${escape(post.id)}" aria-label="Post options">•••</button></div>${post.image ? `<img class="post-image" src="${photo(post.image, 1000)}" alt="Photo shared by ${escape(person.name)}" loading="lazy">` : ""}<div class="post-actions"><button class="${liked ? "liked" : ""}" data-action="like" data-post-id="${escape(post.id)}" aria-label="${liked ? "Unlike" : "Like"} post">${liked ? "♥" : "♡"}</button><button data-action="comment" data-post-id="${escape(post.id)}" aria-label="Comment">◯</button><button data-action="share" data-post-id="${escape(post.id)}" aria-label="Share">↗</button><button class="post-more ${saved ? "saved" : ""}" data-action="save" data-post-id="${escape(post.id)}" aria-label="${saved ? "Unsave" : "Save"}">${saved ? "▣" : "▢"}</button></div><div class="post-copy"><strong class="like-count">${(post.likes || 0) + (liked ? 1 : 0)} appreciations</strong><p><strong>${escape(person.name.split(" ")[0])}</strong> ${escape(post.caption)}</p><div class="post-tags">${(post.tags || []).map(tag => `<button data-tag="${escape(tag)}">#${escape(tag.replace(/\s/g, ""))}</button>`).join("")}</div><button class="comments-link" data-action="comment" data-post-id="${escape(post.id)}">View all ${(post.comments || 0) + comments.length} notes</button><div class="comment-list">${comments.map(comment => `<p><strong>${escape(state.profile.name.split(" ")[0])}</strong> ${escape(comment)}</p>`).join("")}</div><form class="quick-comment" data-comment-form="${escape(post.id)}"><input aria-label="Write a comment" placeholder="Leave a kind note…"><button type="submit" aria-label="Send comment">↑</button></form></div></article>`;
  }
  function renderHome() {
    let posts = [...allPosts()].reverse();
    if (state.filter === "Following") {
      const followed = new Set(["maya", ...state.connections]);
      posts = posts.filter(post => followed.has(post.person));
    }
    return `${renderStories()}${renderSuggestionPanel()}<section class="feed-section"><div class="section-title-row"><div><span class="section-kicker">A GOOD PLACE TO BEGIN</span><h2 class="section-title">Your feed</h2></div><button class="subtle-button" data-action="create">＋ Create a post</button></div><div class="feed-tabs">${["For you", "Following"].map(filter => `<button class="${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>`).join("")}</div>${posts.length ? posts.map(renderPost).join("") : '<section class="content-card empty-state">Your Following feed will show posts from people you connect with.</section>'}</section>`;
  }
  function renderDiscover() {
    const query = state.query.trim().toLowerCase();
    const people = data.people.filter(person => person.id !== "maya" && (!query || `${person.name} ${person.occupation} ${person.city} ${person.interests.join(" ")}`.toLowerCase().includes(query)));
    return `<div class="view-intro"><span class="section-kicker">GOOD ENERGY, NO SWIPING RUSH</span><h2>Make room for a new hello.</h2><p>Meet people who might feel like your kind of people. Take your time.</p></div><label class="search-field" aria-label="Search people">⌕<input data-discover-search type="search" value="${escape(state.query)}" placeholder="Search names, interests, places…"></label><div class="discover-grid" style="margin-top:15px">${people.length ? people.map(person => `<article class="person-card">${avatar(person, 600).replace('class="avatar"', 'class="person-cover"')}<div class="person-card-body"><h3>${escape(person.name)}, ${person.age}</h3><small>${escape(person.occupation)} · ${escape(person.city)}</small><p>${escape(person.bio)}</p><div class="interest-list">${person.interests.map(interest => `<span>${escape(interest)}</span>`).join("")}</div><button class="primary-button" data-action="hello" data-person-id="${person.id}">${state.connections.includes(person.id) ? "Hello sent ✓" : "Say hello ♡"}</button></div></article>`).join("") : '<p class="empty-state">No profiles match yet. Try another search.</p>'}</div>${renderSuggestionPanel()}`;
  }
  function renderClips() {
    return `<div class="view-intro"><span class="section-kicker">SHORT MOMENTS, REAL PEOPLE</span><h2>A few good Clips.</h2><p>Little films from people living their everyday stories.</p></div><div class="vignettes-list">${data.vignettes.map((clip, index) => {
      const person = personFor(clip.person);
      return `<article class="vignette-card" data-clip="${clip.id}"><img class="vignette-poster" src="${photo(clip.poster, 600)}" alt="" loading="lazy"><video class="vignette-video" src="${escape(clip.video)}" poster="${photo(clip.poster, 600)}" muted playsinline webkit-playsinline preload="none" aria-label="${escape(clip.caption)}"></video><div class="vignette-gradient"></div><div class="vignette-topline"><span>✳ A LITTLE FILM</span><span>UP TO 1 MIN · ${String(index + 1).padStart(2, "0")}</span></div><div class="vignette-copy"><button class="vignette-author" data-person="${person.id}">${avatar(person, 80)}<span><strong>${escape(person.name)}</strong><small>${escape(person.occupation)}</small></span></button><p>${escape(clip.caption)}</p><div>${clip.tags.map(tag => `#${escape(tag.replace(/\s/g, ""))} `).join("")}</div></div><div class="vignette-actions"><button class="vignette-action" data-action="toggle-clip" aria-label="Play or pause Clip"><span>▷</span><small>Play</small></button><button class="vignette-action" data-action="share" data-post-id="${clip.id}" aria-label="Share Clip"><span>↗</span><small>Share</small></button></div></article>`;
    }).join("")}</div>`;
  }
  function renderProfile() {
    const ownPosts = state.posts.filter(post => post.person === "maya");
    const followerPeople = [personFor("sofia"), personFor("dev"), personFor("lena")];
    return `<section class="content-card"><div class="profile-cover"></div><div class="profile-summary">${avatar(personFor("maya"), 200)}<button class="subtle-button" data-action="edit-profile" style="float:right;margin-top:8px">Edit profile</button><h2>${escape(state.profile.name)}${state.profile.age ? `, ${escape(state.profile.age)}` : ""}</h2><small>${escape(state.profile.occupation)} · ${escape(state.profile.city)}</small><p>${escape(state.profile.bio)}</p><div class="profile-stats"><button class="profile-stat" data-action="show-people" data-list="followers"><strong>${followerPeople.length}</strong><span>Followers</span></button><button class="profile-stat" data-action="show-people" data-list="following"><strong>${state.connections.length}</strong><span>Following</span></button><button class="profile-stat"><strong>${ownPosts.length}</strong><span>Moments</span></button></div></div></section>${renderSuggestionPanel()}<section class="content-card"><div class="section-title-row"><div><span class="section-kicker">YOUR LITTLE COLLECTION</span><h2 class="section-title">Your moments</h2></div><button class="subtle-button" data-action="create">＋ Add a moment</button></div>${ownPosts.length ? `<div class="profile-tiles">${ownPosts.map(post => `<img class="profile-tile" src="${photo(post.image, 400)}" alt="${escape(post.caption)}">`).join("")}</div>` : '<p class="empty-state">Your first moment can start right here.</p>'}</section>`;
  }
  function messagesFor(personId) {
    return state.messages[personId] || ["Hi! I liked what you shared about finding joy in the little things.", "Thank you! That really made my day. What have you been enjoying lately?"];
  }
  function renderMessages() {
    const people = data.people.filter(person => person.id !== "maya");
    const selected = personFor(state.selectedPerson);
    return `<div class="view-intro"><span class="section-kicker">KIND WORDS, AT YOUR OWN PACE</span><h2>A thoughtful hello goes a long way.</h2></div><div class="messages-layout"><nav class="conversation-list" aria-label="Conversations">${people.map(person => { const messages = messagesFor(person.id); return `<button class="conversation-item ${person.id === selected.id ? "active" : ""}" data-action="select-conversation" data-person-id="${person.id}">${avatar(person, 90)}<span><strong>${escape(person.name)}</strong><small>${escape(messages[messages.length - 1] || "Say hello")}</small></span></button>`; }).join("")}</nav><section class="thread-view"><div class="thread-heading">${avatar(selected, 90)}<strong>${escape(selected.name)}</strong></div><div class="thread-messages">${messagesFor(selected.id).map((message, index) => `<div class="bubble ${index % 2 ? "mine" : ""}">${escape(message)}</div>`).join("")}</div><form class="message-composer" data-message-form="${selected.id}"><input aria-label="Write a message" placeholder="Write a kind note…"><button type="submit" aria-label="Send message">↑</button></form></section></div>`;
  }
  function renderSaved() {
    const savedPosts = allPosts().filter(post => state.saved.includes(post.id));
    return `<div class="view-intro"><span class="section-kicker">LITTLE THINGS WORTH KEEPING</span><h2>Your saved moments.</h2><p>Posts you have tucked away for later.</p></div>${savedPosts.length ? savedPosts.map(renderPost).join("") : '<section class="content-card empty-state">No saved posts yet. Tap the bookmark on a post to keep it here.</section>'}`;
  }
  function render() {
    const views = { home: renderHome, discover: renderDiscover, vignettes: renderClips, profile: renderProfile, messages: renderMessages, saved: renderSaved };
    const titles = { home: "Your little corner of the world", discover: "Make room for a new hello", vignettes: "A few good Clips", profile: "This is your story", messages: "A thoughtful hello goes a long way", saved: "Little things worth keeping" };
    document.querySelector("#page-title").innerHTML = `${escape(titles[state.view] || titles.home)}<span>.</span>`;
    document.querySelector("#eyebrow").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
    document.querySelector(".top-avatar img").src = profileImage();
    document.querySelector(".top-avatar img").alt = `${state.profile.name}'s profile`;
    document.querySelector("#profile-greeting").textContent = `Hey, ${state.profile.name.split(/\s+/)[0]}`;
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
    const people = which === "followers" ? [personFor("sofia"), personFor("dev"), personFor("lena")] : state.connections.map(personFor);
    showModal(`<span class="section-kicker">YOUR BLEND COMMUNITY</span><h2>${which === "followers" ? "Followers" : "Following"} · ${people.length}</h2>${people.length ? people.map(person => `<div class="profile-person-row">${avatar(person)}<span><strong>${escape(person.name)}</strong><small>${escape(person.occupation)} · ${escape(person.city)}</small></span></div>`).join("") : '<p class="empty-state">Your list will grow as you connect.</p>'}`, which);
  }
  function createPostForm() {
    return `<span class="section-kicker">A MOMENT FROM YOUR WORLD</span><h2>Share what feels like you.</h2><p class="modal-description">Add media and a caption for your moment.</p><form id="create-form" class="create-form"><label class="media-picker"><span>Add media</span><input name="media" type="file" accept="image/*" capture="environment"></label><img class="post-preview" hidden alt="Photo preview"><button type="button" class="subtle-button" data-action="toggle-location">＋ Add location</button><label class="location-field" hidden>Place or city<input name="location" placeholder="Add a place or city"></label><label>Your caption<textarea name="caption" required maxlength="500" placeholder="A little piece of your day…"></textarea></label><label>Who gets to see this?<select name="audience"><option>Everyone</option><option>Connections only</option><option>Only me</option></select></label><p class="upload-error" hidden></p><button class="primary-button" type="submit">Share my moment ↗</button></form>`;
  }
  function openCreateStory() {
    showModal(`<span class="section-kicker">LITTLE WINDOWS INTO YOUR DAY</span><h2>Add to your story.</h2><form id="story-form" class="create-form"><label>Choose a photo or video<input name="story" type="file" accept="image/*,video/*" capture="environment"></label><label>Say a little something<textarea name="caption" maxlength="180" placeholder="A little moment from today…"></textarea></label><p class="upload-error" hidden></p><button type="submit" class="primary-button">Share my story ✿</button></form>`, "Create a story");
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
    if (button.dataset.action === "create") { showModal(createPostForm(), "Create a post"); return; }
    if (button.dataset.action === "create-story") { openCreateStory(); return; }
    if (button.dataset.action === "edit-profile") {
      showModal(`<span class="section-kicker">LET YOUR PROFILE FEEL LIKE YOU</span><h2>Edit your profile.</h2><form id="profile-form" class="create-form"><label>Name<input name="name" required value="${escape(state.profile.name)}"></label><label>Age<input name="age" type="number" min="18" max="99" value="${escape(state.profile.age)}"></label><label>Profession<input name="occupation" value="${escape(state.profile.occupation)}"></label><label>City<input name="city" value="${escape(state.profile.city)}"></label><label>A little about you<textarea name="bio" maxlength="280">${escape(state.profile.bio)}</textarea></label><label>Profile photo<input name="photo" type="file" accept="image/*" capture="user"></label><p class="upload-error" hidden></p><button class="primary-button" type="submit">Save my details ✓</button></form>`, "Edit your profile"); return;
    }
    if (button.dataset.action === "toggle-location") { const label = modalRoot.querySelector(".location-field"); label.hidden = !label.hidden; if (!label.hidden) label.querySelector("input").focus(); return; }
    if (button.dataset.action === "hello") {
      const id = button.dataset.personId;
      if (state.connections.includes(id)) { toast("You have already sent a hello."); return; }
      state.connections.push(id); write("connections", state.connections); render(); toast(`A friendly hello is on its way to ${personFor(id).name.split(" ")[0]}.`); return;
    }
    if (button.dataset.action === "like") {
      const id = button.dataset.postId;
      state.likes = state.likes.includes(id) ? state.likes.filter(item => item !== id) : [...state.likes, id];
      write("likes", state.likes); render(); return;
    }
    if (button.dataset.action === "save") {
      const id = button.dataset.postId;
      state.saved = state.saved.includes(id) ? state.saved.filter(item => item !== id) : [...state.saved, id];
      write("saved", state.saved); render(); toast(state.saved.includes(id) ? "Saved to your moments." : "Removed from saved moments."); return;
    }
    if (button.dataset.action === "comment") { root.querySelector(`[data-comment-form="${CSS.escape(button.dataset.postId)}"] input`)?.focus(); return; }
    if (button.dataset.action === "share") { await shareLink(location.href.split("#")[0] + `#${encodeURIComponent(button.dataset.postId)}`); return; }
    if (button.dataset.action === "post-options") {
      const id = button.dataset.postId;
      const ownPost = state.posts.some(post => post.id === id);
      showModal(`<span class="section-kicker">A LITTLE NOTE</span><h2>Post options</h2><button class="primary-button" data-action="save" data-post-id="${escape(id)}">Save or remove saved post</button>${ownPost ? `<button class="text-button" data-action="delete-post" data-post-id="${escape(id)}" style="margin:10px 0;color:#a34f58">Delete my post</button>` : ""}<p class="modal-description" style="margin-top:14px">Reports are not connected to a moderation service in this demo.</p><button class="text-button" data-action="close-modal">Close</button>`, "Post options"); return;
    }
    if (button.dataset.action === "delete-post") {
      const id = button.dataset.postId;
      state.posts = state.posts.filter(post => post.id !== id);
      write("posts", state.posts); closeModal(); render(); toast("Your post has been deleted."); return;
    }
    if (button.dataset.action === "open-story") {
      const person = personFor(button.dataset.personId);
      const story = button.dataset.personId === "maya" ? { image: state.profile.storyImage || person.image, type: state.profile.storyType, caption: state.profile.storyCaption || "A little hello from my day." } : data.stories.find(item => item.id === button.dataset.storyId);
      const ownStory = button.dataset.personId === "maya" && Boolean(state.profile.storyImage);
      const storyMedia = story?.type === "video"
        ? `<video class="story-media" src="${photo(story.image)}" playsinline webkit-playsinline controls></video>`
        : `<img class="story-media" src="${photo(story?.image || person.image, 900)}" alt="">`;
      showModal(`<div class="story-viewer">${storyMedia}<div class="story-viewer-content"><div class="story-viewer-head">${avatar(person)}<strong>${escape(person.name)}</strong><button data-action="close-modal" aria-label="Close story">×</button></div><div><p>${escape(story?.caption || "")}</p>${ownStory ? '<button data-action="delete-story">Delete my story</button>' : `<button data-action="reply-story" data-person-id="${person.id}">Send a kind reply</button>`}</div></div></div>`, "Story"); return;
    }
    if (button.dataset.action === "delete-story") {
      delete state.profile.storyImage;
      delete state.profile.storyCaption;
      delete state.profile.storyType;
      write("profile", state.profile); closeModal(); render(); toast("Your story has been deleted."); return;
    }
    if (button.dataset.action === "reply-story") { const id = button.dataset.personId; closeModal(); state.selectedPerson = id; state.view = "messages"; render(); toast(`Your conversation with ${personFor(id).name} is ready.`); return; }
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
      const matches = data.people.filter(person => person.id !== "maya" && `${person.name} ${person.occupation} ${person.city} ${person.interests.join(" ")}`.toLowerCase().includes(query));
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
        const post = { id: `local-${Date.now()}`, person: "maya", image, caption, location: form.elements.location.value.trim(), audience: form.elements.audience.value, likes: 0, comments: 0, time: "Just now", tags: [] };
        state.posts.unshift(post); write("posts", state.posts); closeModal(); state.view = "home"; render(); toast("Your moment has been shared.");
      } catch (exception) { error.textContent = exception.message || "Could not share this moment."; error.hidden = false; }
      finally { if (submit.isConnected) submit.disabled = false; }
    }
    if (form.id === "story-form") {
      event.preventDefault();
      const error = form.querySelector(".upload-error");
      try {
        const mediaFile = form.elements.story.files[0];
        const storyImage = await imageFromFile(mediaFile, true);
        if (storyImage) {
          state.profile.storyImage = storyImage;
          state.profile.storyType = mediaFile.type.startsWith("video/") ? "video" : "image";
        }
        state.profile.storyCaption = form.elements.caption.value.trim();
        write("profile", state.profile); closeModal(); render(); toast("Your story is ready to view.");
      } catch (exception) { error.textContent = exception.message || "Could not add this story."; error.hidden = false; }
    }
    if (form.id === "profile-form") {
      event.preventDefault();
      const error = form.querySelector(".upload-error");
      try {
        const formData = new FormData(form);
        Object.assign(state.profile, { name: String(formData.get("name")).trim(), age: String(formData.get("age") || ""), occupation: String(formData.get("occupation") || "").trim(), city: String(formData.get("city") || "").trim(), bio: String(formData.get("bio") || "").trim() });
        if (form.elements.photo.files[0]) state.profile.image = await resizeImage(form.elements.photo.files[0], 600);
        write("profile", state.profile); closeModal(); render(); toast("Your profile has been updated.");
      } catch (exception) { error.textContent = exception.message || "Could not update your profile."; error.hidden = false; }
    }
    if (form.matches("[data-comment-form]")) {
      event.preventDefault();
      const comment = form.querySelector("input").value.trim();
      if (!comment) return;
      const id = form.dataset.commentForm;
      state.comments[id] = [...(state.comments[id] || []), comment];
      write("comments", state.comments); render();
    }
    if (form.matches("[data-message-form]")) {
      event.preventDefault();
      const input = form.querySelector("input");
      const message = input.value.trim();
      if (!message) return;
      const id = form.dataset.messageForm;
      state.messages[id] = [...messagesFor(id), message];
      write("messages", state.messages); render();
    }
  });

  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
  document.querySelectorAll("[data-intent]").forEach(button => {
    button.classList.toggle("selected", button.dataset.intent === state.intent);
    button.addEventListener("click", () => {
      state.intent = button.dataset.intent;
      write("intent", state.intent);
      document.querySelectorAll("[data-intent]").forEach(option => option.classList.toggle("selected", option === button));
      toast(`Your check-in is set to “${state.intent}”.`);
    });
  });
  render();
})();
