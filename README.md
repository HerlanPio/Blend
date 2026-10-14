# Blend — a softer kind of social

Blend is a responsive front-end prototype for a more thoughtful social experience. Instead of a fast-paced scroll or a swipe-based dating flow, it creates a warm, human-first environment where people can share moments, explore meaningful connections, and move at a pace that feels comfortable.

The experience blends social media, discovery, and personal curation into a single interface. Users can browse a home feed, view short stories, create new posts, meet people with shared interests, watch short vertical clips, send thoughtful messages, and edit their profile without needing a backend or account system.

## What this website is

Blend is best described as a social discovery concept that emphasizes intention over pressure. It is designed for people who want to:

- share everyday experiences without the noise of a traditional social feed
- discover people who feel genuinely aligned with their values and lifestyle
- start with a simple, respectful hello instead of an immediate match decision
- keep things slow, genuine, and easy to control

The app presents a friendly, calming visual style and focuses on low-pressure interactions. It is a demo experience, not a production social platform.

## Core experience

### Home feed
- Stories from people in the community
- Post cards with captions, image content, likes, comments, saves, and quick sharing
- Feed filters for "For you" and "Following"
- Quick actions for interacting with content without friction

### Discovery
- Search by name, place, occupation, or interests
- Suggested profiles for people who may be a good cultural fit
- "Say hello" interactions that feel gentle and intentional rather than transactional

### Clips and media
- Short vertical-style media cards
- Playable demo videos with posters and captions
- Bite-sized moments designed to feel intimate and human

### Messages and profile
- Simple messaging conversations with selected people
- Profile editing for your own bio, city, occupation, and image details
- Follow/follower style stats and curated profile moments
- Saved content and personal media collections

### Creating content
- Add a new post with optional image upload
- Upload photo content directly in-browser
- Create and delete your own story
- Keep local changes saved in the browser using localStorage

## Technology

Blend is built with plain HTML, CSS, and JavaScript, with no external runtime dependencies required. The app is served locally via a lightweight Node.js HTTP server and uses browser-side local storage to persist user-created content and preferences.

## Browser compatibility

Blend runs in current versions of Chrome, Microsoft Edge, Brave, Firefox, and Safari. These browsers can all open the same local address; no browser extension or browser-specific setup is required.

1. Start the server using the instructions below.
2. Open `http://localhost:5173` in whichever browser you want to use.
3. To use another browser, enter that same address there.

Use a recent browser version for the best experience. If a browser does not support a feature such as automatic Clip playback, the rest of the site remains usable and Clips can be played manually. Photos, videos, and web fonts hosted externally need an internet connection. Profile edits and other saved demo data are stored separately in each browser's local storage, so they are not shared between browsers.

## Browser-only demo

This project is intentionally a prototype. It includes illustrative profile data, demo conversations, and sample media. It does not include:

- real authentication or user accounts
- a backend database or API
- moderation, moderation workflows, or real matchmaking logic
- production networking or live social integrations

External sample photos, videos, and fonts are loaded from public sources and require an internet connection to render properly.

## Run locally

From the project folder:

```powershell
cd C:\Users\Herlan\Documents\blend-app
npm run dev
```

If port 5173 is already in use, start the app on a different port:

```powershell
cd C:\Users\Herlan\Documents\blend-app
$env:PORT = 4173
npm run dev
```

Then open:

- http://localhost:5173 if you kept the default port
- http://localhost:4173 if you used the custom port above

To view it on a phone, connect the phone and computer to the same Wi-Fi network and open the computer's local network IP on the same port.

## Project purpose

Blend is designed to explore a calmer, more intentional model of online connection. It emphasizes:

- emotional clarity over hype
- thoughtful discovery over endless scrolling
- personal agency over algorithmic pressure
- warm, realistic social interactions over gamified engagement

The result is a concept website that feels like a digital space built around sincerity, curiosity, and genuine human connection.
