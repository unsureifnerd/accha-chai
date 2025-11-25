# ☕ Accha Chai

**Discover the best chai stalls near you** - A community-driven app where chai lovers share their favorite spots across India.

## 🚀 Try It Now
**https://accha-chai.web.app**

---

## What Can You Do?

### 🗺️ **Explore**
- Find chai stalls on an interactive map with smart clustering
- Browse "Newly Added" stalls (last 30 days) or "Best in Area" (top-rated)
- Adjust search radius from 1km to 100km
- See 5-star ratings from the community
- Get directions to any stall via Google Maps
- Tap any stall to view photos, ratings, and details

### ➕ **Contribute**
- Add new chai stalls with photos
- Rate stalls you've visited
- Search by address or drop a pin manually

### ❤️ **Save & Share**
- Bookmark your favorite stalls
- Share discoveries with friends
- Edit or delete your own posts

### 👤 **Track**
- View your profile and contribution stats
- See all stalls you've added
- Manage your saved favorites

---

## 📱 How to Use

### On Mobile
**Install as an app:**
- **Android:** Chrome → Menu (⋮) → "Install app"
- **iOS:** Safari → Share (□↑) → "Add to Home Screen"

### Sign In
- Tap "Sign In" and use your Google account
- Currently in private beta (whitelist required)

---

## 🚧 Coming Soon
- Content moderation tools
- Report closed/incorrect stalls
- Community verification system
- Achievements & chai points

---

## 💡 Vision
Built for the chai community, by the chai community.

No ads. No premium features. Just authentic chai discovery.

---

## 👨‍💻 For Developers

### Tech Stack
- React + Vite
- Firebase (Auth, Firestore, Hosting)
- Google Maps API
- Tailwind CSS
- PWA

### Local Development
```bash
npm install
npm run dev
```

### Current Version
**v0.5.1** (November 25, 2025)
Status: Private Beta

### Recent Major Updates
- **Explore page** (Newly Added & Best in Area tabs with distance filtering)
- **Map clustering** (progressive grouping, zoom-responsive badges)
- **5-star rating system** (migrated from 3-tier Accha/Thik-Thak/Nahi)
- **Account deletion** (GDPR-compliant with data anonymization)
- **Email hash anti-gaming** (prevents rating manipulation)
- **7-rating minimum threshold** (ensures quality aggregated ratings)
- Enhanced marker visibility (vibrant colors, drop shadows, larger size)
- Community rating aggregation (accurate averages from all users)
- Address search with autocomplete

### Known Technical Debt
- Google Maps APIs using deprecated versions (via `@react-google-maps/api`)
- Will migrate when library adds support for new APIs
- No impact on functionality (12+ months before deprecation)

---

Built with ❤️ and ☕ in India

**Questions?** Open an issue or contact the developer through the app.
