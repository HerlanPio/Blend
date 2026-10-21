# Blend — a softer kind of social

Blend is a responsive front-end prototype for a more thoughtful social experience. Instead of a fast-paced scroll or a swipe-based dating flow, it creates a warm, human-first environment where people can share moments, explore meaningful connections, and move at a pace that feels comfortable.

The experience blends social media, discovery, and personal curation into a single interface. Users can browse a home feed, view short stories, create new posts, meet people with shared interests, watch short vertical clips, send thoughtful messages, and edit their profile. The local demo works without an account; the optional Netlify + Supabase backend enables shared accounts and data.

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

Blend uses plain HTML, CSS, and JavaScript with a lightweight Node.js development server. Its optional shared backend uses Netlify Functions, Supabase Auth, a PostgreSQL database with row-level security, and Supabase Storage. Without Supabase configuration, the original local demo remains available and saves data in the current browser.

## Browser compatibility

Blend runs in current versions of Chrome, Microsoft Edge, Brave, Firefox, and Safari. These browsers can all open the same local address; no browser extension or browser-specific setup is required.

1. Start the server using the instructions below.
2. Open `http://localhost:5173` in whichever browser you want to use.
3. To use another browser, enter that same address there.

Use a recent browser version for the best experience. If a browser does not support a feature such as automatic Clip playback, the rest of the site remains usable and Clips can be played manually. Photos, videos, and web fonts hosted externally need an internet connection. Profile edits and other saved demo data are stored separately in each browser's local storage, so they are not shared between browsers.

## Publish a public link

The site is static and requires no build step. Deployment configuration is included for GitHub Pages, Netlify, and Vercel:

- **GitHub Pages:** Push the `main` branch to GitHub and set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow deploys on each push to `main`. Once deployment succeeds, the project URL is `https://herlanpio.github.io/Blend/`.
- **Netlify:** Import this GitHub repository as a new site. The included `netlify.toml` publishes the site and deploys the `/api` function. Set the Supabase environment variables described below to enable shared accounts and data; without them, the site remains in local demo mode.
- **Vercel:** Import this GitHub repository as a new project. The included `vercel.json` sets the output directory to the repository root; leave the build command empty. Vercel will assign the public URL after deployment.

Each deployed URL works in supported browsers. The first deployment requires authorizing the chosen provider and connecting it to the GitHub repository. The backend described below is configured for Netlify; GitHub Pages and Vercel deployments remain static demos.

### Backend setup (Netlify + Supabase)

The Netlify deployment includes an `/api` function endpoint. To enable real accounts and shared data:

1. Create a Supabase project and copy its project URL and publishable/anon key.
2. In the Supabase SQL editor, run the files in [`supabase/migrations`](./supabase/migrations) in filename order. The initial migration creates the profile, post, story, follow, like, bookmark, comment, conversation, and message tables, their row-level security policies, and the private media bucket. The privacy migration adds profile discoverability, message-request controls, per-story audience rules, account blocking, and report storage.
   If your project already ran the initial migration, run only [`202610200001_privacy_controls.sql`](./supabase/migrations/202610200001_privacy_controls.sql).
3. In Netlify, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as site environment variables, then redeploy.
4. In Supabase Auth settings, configure the production site URL and allowed redirect URLs. Email confirmation can be enabled in the Supabase dashboard.
5. Open the site and use **Account & sign in** to create an account or sign in. The API sends media using short-lived signed URLs; uploaded media is private and authorization follows the post/story visibility rules.

For local development, copy `.env.example` to `.env`, set the same Supabase values, and run `npm run dev`:

```powershell
Copy-Item .env.example .env
# Edit .env with the project URL and publishable/anon key.
npm run dev
```

Never put a Supabase service-role key in the browser or commit secrets. The backend is deployed only with the Netlify configuration; GitHub Pages and Vercel continue to host the static demo unless their own API deployments are configured.

The backend provides email/password authentication, profile edits, profile discoverability controls, message-request controls, posts and 24-hour stories with audience settings, follows, likes, comments, saved posts, one-to-one messaging, account blocking, report submission, and private photo/video uploads. Reports are stored for review, but this starter does not include a moderation review dashboard, live message delivery, password-reset UI, or clips persistence.

## Browser-only demo

Without backend credentials, the website runs in prototype mode with illustrative profile data, demo conversations, and sample media. The hosted Supabase mode stores user content centrally, but is still a starter rather than a fully production-hardened social network. It does not include:

- moderation workflows or real matchmaking logic
- production networking or live social integrations

Privacy settings and blocked accounts in the browser-only demo are saved in that browser. Reporting requires a signed-in Supabase account; reports are stored in the database, with no review dashboard in this starter.

External sample photos, videos, and fonts are loaded from public sources and require an internet connection to render properly.

## Run locally

From the project folder:

```powershell
cd C:\Users\Herlan\Documents\blend-app
npm run dev
```

Run the API tests with:

```powershell
npm test
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

7. 🚀 Live Demo

🔗 Live Site: https://blend-web.netlify.app/

## Project purpose

Blend is designed to explore a calmer, more intentional model of online connection. It emphasizes:

- emotional clarity over hype
- thoughtful discovery over endless scrolling
- personal agency over algorithmic pressure
- warm, realistic social interactions over gamified engagement

The result is a concept website that feels like a digital space built around sincerity, curiosity, and genuine human connection.
