# Blend — where your worlds meet

Blend is a responsive front-end prototype combining a social feed with intentional, relationship-minded discovery. It uses plain HTML, CSS, and JavaScript and has no runtime dependencies.

## Run locally

```powershell
cd C:\Users\Herlan\Documents\blend-app
npm.cmd run dev
```

Open <http://localhost:5173>. To view it on a phone, connect the phone and computer to the same Wi-Fi and open the computer's local network IP at port 5173.

## Features

- Responsive desktop and mobile navigation with phone safe-area spacing.
- Stories, feed posts, photo uploads, post creation, comments, likes, saves, and sharing.
- Discovery search, profile suggestions, hello requests, profile editing, and follower/following lists.
- Short vertical Clips and demo conversations.
- Profile, posts, saved items, messages, and preferences persist locally in the browser.

This is a browser-only prototype. People, stories, Clips, follower profiles, and conversations are illustrative demo content; it has no account system, backend, real matchmaking, or moderation service. External sample photos, videos, and fonts require an internet connection. Local uploads and profile data stay in the browser.
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
