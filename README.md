# ☕ Accha Chai

Community-driven app to discover the best chai stalls in India.

## 🚀 Live Demo
**https://accha-chai.web.app**

## ✨ Features (Current - Beta v0.4)
- 🗺️ Google Maps integration with real-time location
- 📍 **Pin placement with address search** (Google Places Autocomplete)
- 🔍 **Unified search & pin placement screen** (type address OR manually place pin)
- 🔐 Google Sign-In authentication
- 🔒 Beta access whitelist system (Firestore-based)
- 📸 Camera & gallery photo upload with **auto-compression**
- ⭐ Rating system (Accha/Thik-Thak/Nahi) with **detailed breakdown**
- 🏷️ **Custom stall names** when posting
- 👤 **Profile page with user stats**
- ✏️ **Edit your stalls** (photo, name, rating, description)
- 🗑️ **Delete your stalls** (with community ownership protection)
- 🏛️ **Community ownership** (stalls older than 7 days protected)
- ❤️ **Save stalls to favorites** (bookmark stalls you love)
- 🔗 **Share stalls** (native share on mobile, copy link on desktop)
- 👋 **Account management** (logout, delete account)
- 📧 **Contact developer** (quick support link)
- 🖼️ **Fullscreen image viewer** (tap to zoom, tap outside to close)
- 📱 **Draggable stall detail panel** (iOS-style bottom sheet)
- 💾 Cloud database (Firebase Firestore)
- 📱 Mobile-responsive PWA (installable)
- 🧭 My Location button on all maps
- 👆 **Single-finger map movement**

## 🚧 Coming Soon
- 🔍 Explore feed (list view of all stalls)
- 🔎 Search & filter stalls
- 🖼️ Cloudinary photo optimization
- 💬 Rate others' stalls
- 📍 Report closed stalls
- 🏆 Chai points & badges

## 🛠️ Tech Stack
- React + Vite
- Firebase (Auth, Firestore, Hosting)
- Google Maps API
- Tailwind CSS
- PWA (Progressive Web App)

## 📱 Installation
**As PWA:**
- Android: Open in Chrome → Menu → "Install app"
- iOS: Open in Safari → Share → "Add to Home Screen"

**Local Development:**
```bash
npm install
npm run dev
```

## 🎯 Vision
For the community, by the community. No ads, no premium features, just authentic chai discovery.

Built with ❤️ and ☕

---

**Status:** Beta Testing (v0.4)
**Started:** November 2025
**Last Updated:** November 20, 2025
**Current Phase:** Private Beta (Whitelist-based)

## 🎯 Recent Updates (v0.4 - November 20, 2025)
- ✅ **Redesigned stall detail UI** with full-width photo banner
- ✅ **Draggable/resizable bottom sheet panel** (iOS-style with backdrop)
- ✅ **Fullscreen image viewer** (tap to zoom, tap outside to close)
- ✅ **Address search with Google Places Autocomplete** (unified screen)
- ✅ **Smooth map transitions** when searching locations
- ✅ **My Location button** on pin placement map
- ✅ **Clear button** for search bar to reset location
- ✅ **Improved stall list layouts** (Added/Saved stalls with thumbnails)
- ✅ **Centered grey bar** in pull-up panel header
- ✅ **Google Places library integration** for search functionality

## 🎯 Previous Updates (v0.3 - November 14, 2025)
- ✅ Save stalls to favorites (bookmark & view in profile)
- ✅ Share stalls with friends (native share API + deep linking)
- ✅ Contact developer link for support
- ✅ Custom stall names when posting
- ✅ Fixed My Location button duplication issue
- ✅ HTTPS dev server for better local testing

## 🎯 Previous Updates (v0.2)
- ✅ Profile page with user stats and stall management
- ✅ Edit stalls (photo, name, rating, description)
- ✅ Delete stalls with community ownership protection (7+ days)
- ✅ Account management (logout, delete account)
- ✅ Automatic photo compression (70-90% size reduction)
- ✅ Single-finger map movement (improved mobile UX)
- ✅ Fixed camera photo upload issues
- ✅ Better error handling and logging
- ✅ Updated Firestore security rules

---

## 🔧 Technical Debt & Future Improvements

### Google Maps API Deprecations
Google has deprecated some APIs we're currently using (via `@react-google-maps/api`):
- `google.maps.Marker` → Migrate to `AdvancedMarkerElement`
- `google.maps.places.AutocompleteService` → Migrate to `AutocompleteSuggestion`
- `google.maps.places.PlacesService` → Migrate to `Place` API

**Status:** These APIs still work perfectly and won't be discontinued for 12+ months. Migration will happen when:
1. The `@react-google-maps/api` library adds support for new APIs
2. Or we refactor to use Google Maps JS API directly

**Timeline:** Low priority - current implementation is stable and supported.