(() => {
  "use strict";

  const people = [
    { id: "maya", name: "Maya Chen", age: 28, occupation: "Product designer", city: "Brooklyn", image: "photo-1534528741775-53994a69daeb", bio: "Designing a life with room for Sunday markets, overwatered plants, and people who make anywhere feel like home.", interests: ["Art", "Travel", "Coffee"] },
    { id: "sofia", name: "Sofia Reyes", age: 27, occupation: "Photographer", city: "Queens", image: "photo-1524504388940-b1c1722653e1", bio: "Collecting little moments, old records, and places with good light.", interests: ["Photography", "Music", "Travel"] },
    { id: "dev", name: "Dev Patel", age: 30, occupation: "Architect", city: "Jersey City", image: "photo-1500648767791-00dcc994a43e", bio: "Weekend hikes, thoughtful spaces, and a very serious search for great dumplings.", interests: ["Design", "Outdoors", "Food"] },
    { id: "lena", name: "Lena Brooks", age: 26, occupation: "Community storyteller", city: "Brooklyn", image: "photo-1531123897727-8f129e1688ce", bio: "Here for kind people, tiny bookstores, and conversations that go a little longer.", interests: ["Books", "Art", "Community"] },
    { id: "omar", name: "Omar Hassan", age: 31, occupation: "Teacher", city: "Manhattan", image: "photo-1506794778202-cad84cf45f1d", bio: "Finding joy in cooking for friends and getting outside whenever the city lets me.", interests: ["Cooking", "Outdoors", "Family"] },
    { id: "nina", name: "Nina Park", age: 29, occupation: "UX researcher", city: "Queens", image: "photo-1529139574466-a303027c1d8b", bio: "Curious by nature. Currently learning pottery and the names of neighborhood birds.", interests: ["Pottery", "Nature", "Travel"] }
  ];
  const stories = [
    { id: "story-sofia", person: "sofia", image: "photo-1517841905240-472988babdf9", caption: "A slow morning, just how I like it." },
    { id: "story-dev", person: "dev", image: "photo-1511818966892-d7d671e672a2", caption: "A little corner project." },
    { id: "story-lena", person: "lena", image: "photo-1470252649378-9c29740c9fa8", caption: "Golden hour found us." },
    { id: "story-omar", person: "omar", image: "photo-1504674900247-0877df9cc836", caption: "Sunday dinner with the people I love." },
    { id: "story-nina", person: "nina", image: "photo-1470770841072-f978cf4d019e", caption: "Took the long way home." }
  ];
  const posts = [
    { id: "post-sofia", person: "sofia", image: "photo-1470252649378-9c29740c9fa8", caption: "The kind of evening that makes you forget to check your phone. I hope you found a little quiet today too.", likes: 128, comments: 14, time: "18 min ago", tags: ["little moments", "evening light"] },
    { id: "post-dev", person: "dev", image: "photo-1511818966892-d7d671e672a2", caption: "The best part of a new space is imagining the stories that will happen in it.", likes: 84, comments: 9, time: "1 hr ago", tags: ["making things", "design"] },
    { id: "post-lena", person: "lena", image: "photo-1507842217343-583bb7270b66", caption: "Found a bookshop that feels like a warm hello. Saving this little place for a rainy day.", likes: 96, comments: 11, time: "3 hrs ago", tags: ["bookshops", "brooklyn"] }
  ];
  const vignettes = [
    { id: "clip-sofia", person: "sofia", poster: "photo-1490750967868-88aa4486c946", caption: "A little color for a grey afternoon.", video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", tags: ["slow days", "color"] },
    { id: "clip-dev", person: "dev", poster: "photo-1511818966892-d7d671e672a2", caption: "Making room for the things that matter.", video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", tags: ["creative life", "design"] }
  ];
  window.BLEND_DATA = { people, stories, posts, vignettes };
})();
