import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Navigation, Star, Plus, X, LogOut, Phone, Share2, Search } from 'lucide-react';
import GoogleMapComponent from './GoogleMap';
import { addStall as saveStallToDb, getStalls, deleteStall, updateStall, saveStall, unsaveStall, getSavedStalls, rateStall, getStallRatings, getUserRating, trackUserActivity, getBetaUsers } from './firestore';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, deleteUser } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

// Check if user is whitelisted in Firestore
async function checkBetaAccess(email) {
  try {
    const betaUsersRef = collection(db, 'betaUsers');
    const q = query(betaUsersRef, where('email', '==', email), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking beta access:', error);
    return false; // If error, deny access (safe default)
  }
}

// ADMIN EMAIL - Change this to your email
const ADMIN_EMAIL = 'nerdunsure@gmail.com';

// Main App Component
export default function AcchaChai() {
  const [user, setUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showAddStall, setShowAddStall] = useState(false);
  const [selectedStall, setSelectedStall] = useState(null);
  const [stalls, setStalls] = useState([]);
  const [savedStallIds, setSavedStallIds] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [editingStall, setEditingStall] = useState(null);
  const [isPinningLocation, setIsPinningLocation] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const mapRef = useRef(null);
  const isHandlingPopState = useRef(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check if user has beta access
        const hasAccess = await checkBetaAccess(currentUser.email);

        if (!hasAccess) {
          // Sign them out and show message
          await signOut(auth);
          alert('⚠️ Accha Chai is currently in private beta.\n\nTo get access, please contact the developer with your email: ' + currentUser.email);
          setAccessDenied(currentUser.email);
          setUser(null);
          setLoading(false);
          return;
        }

        // Silently track user activity
        trackUserActivity(currentUser.email);

        // Load user's saved stalls
        const saved = await getSavedStalls(currentUser.uid);
        setSavedStallIds(saved);
      }

      setUser(currentUser);
      setAccessDenied(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

useEffect(() => {
  // Get user's actual location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error('Location error:', error);
        // Browser will show native permission dialog
        // If user denies, we just log it and continue without location
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    console.warn('Geolocation not supported by browser');
  }

    // Load stalls from Firestore
    loadStalls();
  }, []);

  const loadStalls = async () => {
    try {
      const stallsData = await getStalls();
      setStalls(stallsData);
    } catch (error) {
      console.error('Error loading stalls:', error);
    }
  };

  // Handle deep linking from shared URLs
  useEffect(() => {
    if (stalls.length === 0 || !user) return;

    const urlParams = new URLSearchParams(window.location.search);
    const sharedStallId = urlParams.get('stall');

    if (sharedStallId) {
      const stall = stalls.find(s => s.id === sharedStallId);
      if (stall) {
        setSelectedStall(stall);
        setActiveTab('home'); // Switch to home tab to show the stall
        // Clean URL without reloading
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [stalls, user]);

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      console.log('✓ beforeinstallprompt event fired!');
      // Prevent the default browser install prompt
      e.preventDefault();
      // Store the event so we can trigger it later
      setDeferredPrompt(e);

      // Check if user dismissed the banner recently (within 7 days)
      const dismissedTime = localStorage.getItem('installBannerDismissed');
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

      if (dismissedTime && (Date.now() - parseInt(dismissedTime)) < sevenDaysInMs) {
        console.log('Install banner dismissed recently, not showing');
        return;
      }

      // Show our custom install banner
      console.log('Showing install banner');
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    console.log('Is app installed (standalone mode)?', isStandalone);

    if (isStandalone) {
      setShowInstallBanner(false);
    }

    // Log browser info
    console.log('User Agent:', navigator.userAgent);
    console.log('Waiting for beforeinstallprompt event...');

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the browser's install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissInstallBanner = () => {
    setShowInstallBanner(false);
    // Store dismissal in localStorage to not show again for a while
    localStorage.setItem('installBannerDismissed', Date.now().toString());
  };

  // History Management - Handle back button
  useEffect(() => {
    const handlePopState = (event) => {
      isHandlingPopState.current = true;

      const state = event.state;

      if (!state) {
        // No state means user went back to initial page load
        // Reset to home tab with nothing selected
        setActiveTab('home');
        setSelectedStall(null);
        setShowAddStall(false);
        setEditingStall(null);
        setIsPinningLocation(false);
        isHandlingPopState.current = false;
        return;
      }

      // Restore the app state from history
      if (state.tab) setActiveTab(state.tab);
      if (state.selectedStallId) {
        const stall = stalls.find(s => s.id === state.selectedStallId);
        setSelectedStall(stall || null);
      } else {
        setSelectedStall(null);
      }
      setShowAddStall(state.showAddStall || false);
      setEditingStall(state.editingStall || null);
      setIsPinningLocation(state.isPinningLocation || false);

      isHandlingPopState.current = false;
    };

    window.addEventListener('popstate', handlePopState);

    // Initialize with a base state if there isn't one
    if (!window.history.state) {
      window.history.replaceState({ tab: 'home' }, '');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [stalls]);

  // Push state to history when navigation changes
  useEffect(() => {
    // Don't push state if we're handling a popstate event
    if (isHandlingPopState.current) return;

    const currentState = {
      tab: activeTab,
      selectedStallId: selectedStall?.id || null,
      showAddStall,
      editingStall,
      isPinningLocation
    };

    // Only push if something changed
    const lastState = window.history.state;
    const hasChanged = !lastState ||
      lastState.tab !== currentState.tab ||
      lastState.selectedStallId !== currentState.selectedStallId ||
      lastState.showAddStall !== currentState.showAddStall ||
      lastState.editingStall !== currentState.editingStall ||
      lastState.isPinningLocation !== currentState.isPinningLocation;

    if (hasChanged) {
      window.history.pushState(currentState, '');
    }
  }, [activeTab, selectedStall, showAddStall, editingStall, isPinningLocation]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">☕</div>
          <p className="text-amber-800">Loading Accha Chai...</p>
        </div>
      </div>
    );
  }

  if (!user && !showAuth) {
    return <LandingScreen onLogin={() => setShowAuth(true)} />;
  }

  if (showAuth && !user) {
    return <AuthScreen onAuthComplete={() => setShowAuth(false)} />;
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-amber-600 text-white px-4 py-3 shadow-md flex items-center safe-area-top">
        <div className="flex items-center gap-2">
          <div className="text-2xl">☕</div>
          <div>
            <h1 className="text-xl font-bold">Accha Chai</h1>
            <p className="text-xs text-amber-100">
              {user?.displayName || user?.email || 'Chai Explorer'}
            </p>
          </div>
        </div>
      </header>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg flex items-center justify-between animate-slide-down">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-2xl">☕</div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Install Accha Chai</p>
              <p className="text-xs text-amber-50">Get quick access from your home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-white text-amber-600 px-4 py-1.5 rounded-full font-semibold text-sm hover:bg-amber-50 transition"
            >
              Install
            </button>
            <button
              onClick={handleDismissInstallBanner}
              className="p-1.5 hover:bg-white/20 rounded-full transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Home Tab - Keep mounted, just hide */}
        <div className={activeTab === 'home' ? 'block h-full' : 'hidden'}>
          <MapView 
            stalls={stalls}
            userLocation={userLocation}
            onStallClick={setSelectedStall}
          />

          {/* Stall Detail Bottom Sheet */}
          {selectedStall && (
            <StallDetail
              stall={selectedStall}
              onClose={() => setSelectedStall(null)}
              savedStallIds={savedStallIds}
              currentUser={user}
              onRatingUpdate={() => loadStalls()}
              onToggleSave={async (stallId) => {
                const isSaved = savedStallIds.includes(stallId);
                try {
                  if (isSaved) {
                    await unsaveStall(user.uid, stallId);
                    setSavedStallIds(savedStallIds.filter(id => id !== stallId));
                  } else {
                    await saveStall(user.uid, stallId);
                    setSavedStallIds([...savedStallIds, stallId]);
                  }
                } catch (error) {
                  console.error('Error toggling save:', error);
                  alert('Failed to save stall. Please try again.');
                }
              }}
            />
          )}
        </div>

        {/* Explore Tab */}
        {activeTab === 'explore' && (
          <ComingSoonScreen title="Explore" icon="🔍" />
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <ProfilePage
            user={user}
            stalls={stalls}
            savedStallIds={savedStallIds}
            onEditStall={setEditingStall}
            onDeleteStall={async (stallId) => {
              try {
                await deleteStall(stallId);
                setStalls(stalls.filter(s => s.id !== stallId));
                alert('Stall deleted successfully!');
              } catch (error) {
                console.error('Error deleting stall:', error);
                alert('Failed to delete stall. Please try again.');
              }
            }}
            onSignOut={handleSignOut}
            onDeleteAccount={async () => {
              try {
                // Anonymize user's stalls
                const userStalls = stalls.filter(s => s.addedBy === user.uid);
                for (const stall of userStalls) {
                  await updateStall(stall.id, {
                    addedBy: 'deleted-user',
                    addedByName: 'Anonymous User'
                  });
                }

                // Delete from betaUsers - query by email field first
                const betaUsersRef = collection(db, 'betaUsers');
                const q = query(betaUsersRef, where('email', '==', user.email));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                  await deleteDoc(doc(db, 'betaUsers', snapshot.docs[0].id));
                }

                // Delete auth account
                await deleteUser(auth.currentUser);

                alert('Account deleted successfully.');
              } catch (error) {
                console.error('Error deleting account:', error);
                alert('Failed to delete account. Please try again or contact support.');
              }
            }}
          />
        )}
      </div>

     {/* Bottom Navigation - Simple 4 Tabs */}
     <nav className="bg-white border-t border-gray-200 safe-area-bottom">
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {/* Home Tab */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center py-3 transition ${
            activeTab === 'home' ? 'text-amber-600' : 'text-gray-500'
          }`}
        >
          <MapPin size={24} strokeWidth={2} />
          <span className="text-xs mt-1.5 font-medium">Home</span>
        </button>

        {/* Explore Tab */}
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex flex-col items-center justify-center py-3 transition ${
            activeTab === 'explore' ? 'text-amber-600' : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs mt-1.5 font-medium">Explore</span>
        </button>

        {/* Add Tab */}
        <button
          onClick={() => setIsPinningLocation(true)}
          className={`flex flex-col items-center justify-center py-3 transition ${
            showAddStall ? 'text-amber-600' : 'text-gray-500'
          }`}
        >
          <Plus size={24} strokeWidth={2} />
          <span className="text-xs mt-1.5 font-medium">Add</span>
        </button>

        {/* Profile Tab */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-3 transition ${
            activeTab === 'profile' ? 'text-amber-600' : 'text-gray-500'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs mt-1.5 font-medium">Profile</span>
        </button>
      </div>
     </nav>

      {/* Pin Placement Modal with Search */}
      {isPinningLocation && userLocation && (
        <PinPlacementScreen
          userLocation={userLocation}
          onConfirm={(coords) => {
            setPinnedLocation(coords);
            setIsPinningLocation(false);
            setShowAddStall(true);
          }}
          onCancel={() => {
            setIsPinningLocation(false);
          }}
        />
      )}

      {/* Add Stall Modal */}
      {showAddStall && (
        <AddStallModal
          userLocation={pinnedLocation || userLocation}
          onClose={() => {
            setShowAddStall(false);
            setPinnedLocation(null);
          }}
          onSubmit={async (newStall) => {
            console.log('Submitting stall:', {
              name: newStall.name,
              hasPhoto: !!newStall.photo,
              photoSize: newStall.photo?.length,
              rating: newStall.rating,
              location: newStall.location,
              addedBy: newStall.addedBy
            });
            
            try {
              const savedStall = await saveStallToDb(newStall);
              console.log('Stall saved successfully:', savedStall);
              setStalls([savedStall, ...stalls]);
              setShowAddStall(false);
              setPinnedLocation(null);
              setActiveTab('home'); // Go back to home after posting
              alert('Chai stall added successfully! ☕');
            } catch (error) {
              console.error('Error saving stall - Full details:', {
                message: error.message,
                code: error.code,
                stack: error.stack,
                stallData: newStall
              });
              alert(`Failed to add stall: ${error.message}\n\nCheck console for details.`);
            }
          }}
        />
      )}

      {/* Edit Stall Modal */}
      {editingStall && (
        <EditStallModal
          stall={editingStall}
          onClose={() => setEditingStall(null)}
          onSave={async (updatedStall) => {
            try {
              await updateStall(updatedStall.id, {
                photo: updatedStall.photo,
                rating: updatedStall.rating,
                description: updatedStall.description,
                name: updatedStall.name
              });

              // Update local state
              setStalls(stalls.map(s => s.id === updatedStall.id ? updatedStall : s));
              setEditingStall(null);
              alert('Stall updated successfully! ☕');
            } catch (error) {
              console.error('Error updating stall:', error);
              alert('Failed to update stall. Please try again.');
            }
          }}
        />
      )}
    </div>
  );
}

// Landing Screen
function LandingScreen({ onLogin }) {
  return (
    <div className="h-screen w-full bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl mb-4">☕</div>
        <h1 className="text-5xl font-bold text-amber-900">Accha Chai</h1>
        <p className="text-xl text-amber-800">
          Discover the best chai stalls in your city
        </p>
        <div className="space-y-3 pt-8">
          <div className="flex items-center gap-3 text-amber-900">
            <MapPin className="text-amber-600" />
            <span>Find hidden chai gems near you</span>
          </div>
          <div className="flex items-center gap-3 text-amber-900">
            <Camera className="text-amber-600" />
            <span>Share your favorite spots</span>
          </div>
          <div className="flex items-center gap-3 text-amber-900">
            <Star className="text-amber-600" />
            <span>Rate and review</span>
          </div>
        </div>
        <button
          onClick={onLogin}
          className="mt-8 w-full bg-amber-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-amber-700 transition shadow-lg"
        >
          Get Started
        </button>
        <p className="text-sm text-amber-700 pt-4">
          For the community, by the community 🇮🇳
        </p>
      </div>
    </div>
  );
}

// Auth Screen with Real Firebase
function AuthScreen({ onAuthComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      onAuthComplete();
    } catch (error) {
      console.error('Google sign in error:', error);
      setError(error.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">☕</div>
          <h2 className="text-2xl font-bold text-gray-800">Welcome to Accha Chai</h2>
          <p className="text-gray-600 mt-2">
            Sign in to start discovering and sharing chai spots
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Coming soon</span>
            </div>
          </div>

          <button
            disabled
            className="w-full flex items-center justify-center gap-3 bg-gray-100 text-gray-400 py-3 rounded-lg font-semibold cursor-not-allowed"
          >
            <Phone size={20} />
            Phone Number (Coming Soon)
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>By continuing, you agree to our</p>
          <p className="text-amber-600">Terms of Service & Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}

// Map View Component
function MapView({ stalls, userLocation, onStallClick }) {
  return (
    <div className="w-full h-full relative">
      <GoogleMapComponent 
        stalls={stalls}
        userLocation={userLocation}
        onStallClick={onStallClick}
      />
    </div>
  );
}

// Fullscreen Image Viewer Modal
function FullscreenImageViewer({ imageUrl, stallName, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-[70] flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-30 transition safe-area-top"
      >
        <X size={28} className="text-white" />
      </button>
      <div className="relative max-w-full max-h-full p-4">
        <img
          src={imageUrl}
          alt={stallName}
          className="max-w-full max-h-[90vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        <p className="text-white text-center mt-2 text-sm">Tap outside to close</p>
      </div>
    </div>
  );
}

// Stall Detail Bottom Sheet
function StallDetail({ stall, onClose, savedStallIds, onToggleSave, currentUser, onRatingUpdate }) {
  const isSaved = savedStallIds?.includes(stall.id);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [userRating, setUserRating] = useState(null);
  const [allRatings, setAllRatings] = useState([]);
  const [panelHeight, setPanelHeight] = useState(50); // percentage of viewport height
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(50);

  // Load ratings when component mounts
  useEffect(() => {
    const loadRatings = async () => {
      if (currentUser) {
        const rating = await getUserRating(stall.id, currentUser.uid);
        setUserRating(rating);
      }

      const ratings = await getStallRatings(stall.id);
      setAllRatings(ratings);
    };
    loadRatings();
  }, [stall.id, currentUser]);

  // Handle drag start
  const handleDragStart = (clientY) => {
    setIsDragging(true);
    setStartY(clientY);
    setStartHeight(panelHeight);
  };

  // Handle drag move
  const handleDragMove = (clientY) => {
    if (!isDragging) return;

    const deltaY = startY - clientY;
    const viewportHeight = window.innerHeight;
    const deltaPercent = (deltaY / viewportHeight) * 100;
    const newHeight = Math.min(Math.max(startHeight + deltaPercent, 30), 90);

    setPanelHeight(newHeight);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);

    // Snap to nearest position
    if (panelHeight < 40) {
      onClose(); // Close if dragged down too much
    } else if (panelHeight < 60) {
      setPanelHeight(50); // Snap to half
    } else {
      setPanelHeight(80); // Snap to full
    }
  };

  // Touch handlers
  const handleTouchStart = (e) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse handlers
  const handleMouseDown = (e) => {
    handleDragStart(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startY, startHeight, panelHeight]);

  // Calculate aggregate rating
  const ratingCounts = {
    Accha: allRatings.filter(r => r.rating === 'Accha').length,
    'Thik-Thak': allRatings.filter(r => r.rating === 'Thik-Thak').length,
    Nahi: allRatings.filter(r => r.rating === 'Nahi').length
  };

  const totalRatings = allRatings.length;
  const isOwnStall = currentUser && stall.addedBy === currentUser.uid;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?stall=${stall.id}`;
    const shareData = {
      title: `${stall.name} - Accha Chai`,
      text: `Check out this chai stall: ${stall.name} (${stall.rating}!)`,
      url: shareUrl
    };

    try {
      // Check if Web Share API is supported
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      // User cancelled share or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        // Try clipboard as final fallback
        try {
          await navigator.clipboard.writeText(shareUrl);
          alert('Link copied to clipboard!');
        } catch (clipboardError) {
          alert('Unable to share. Please copy this link:\n' + shareUrl);
        }
      }
    }
  };

  return (
    <>
      {/* Backdrop - Click to close */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet Panel */}
      <div
        className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 flex flex-col transition-all"
        style={{ height: `${panelHeight}vh` }}
      >
        {/* Drag Handle Header */}
        <div
          className="sticky top-0 bg-white px-4 py-3 border-b cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleSave(stall.id)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                {isSaved ? (
                  <svg className="w-6 h-6 text-red-500 fill-current" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                  </svg>
                )}
              </button>
              <button
                onClick={handleShare}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <Share2 size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Centered Drag Handle - vertically aligned with buttons */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
            </div>

            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
        {/* Full-width Photo Banner */}
        <div
          className="w-full h-[200px] bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer overflow-hidden"
          onClick={() => setShowFullscreenImage(true)}
        >
          <img
            src={stall.photo}
            alt={stall.name}
            className="w-full h-full object-cover"
          />
        </div>

      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <h3 className="font-bold text-xl text-gray-800">{stall.name}</h3>
        </div>

        {/* Rating Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-white font-semibold ${
            stall.rating === 'Accha' ? 'bg-green-500' :
            stall.rating === 'Thik-Thak' ? 'bg-yellow-500' :
            'bg-red-500'
          }`}>
            {stall.rating}!
          </span>
          <span className="text-gray-600 text-sm">
            {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
          </span>
        </div>

        {/* Rating Breakdown */}
        {totalRatings > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 w-20">Accha:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${(ratingCounts.Accha / totalRatings) * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-8 text-right">{ratingCounts.Accha}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 w-20">Thik-Thak:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${(ratingCounts['Thik-Thak'] / totalRatings) * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-8 text-right">{ratingCounts['Thik-Thak']}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 w-20">Nahi:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${(ratingCounts.Nahi / totalRatings) * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-600 w-8 text-right">{ratingCounts.Nahi}</span>
            </div>
          </div>
        )}

        {/* Description */}
        {stall.description && (
          <div>
            <p className="text-gray-600">{stall.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button 
            onClick={() => {
              const { lat, lng } = stall.location;
              // Open in Google Maps
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
            }}
            className="flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-lg font-semibold active:bg-blue-600 transition"
          >
            <Navigation size={20} />
            Get Directions
          </button>
          <button
            onClick={() => {
              if (isOwnStall) {
                alert('You cannot rate your own stall');
              } else {
                setShowRatingModal(true);
              }
            }}
            className="flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-lg font-semibold active:bg-amber-600 transition"
          >
            <Star size={20} />
            {userRating ? 'Update Rating' : 'Rate Stall'}
          </button>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {showFullscreenImage && (
        <FullscreenImageViewer
          imageUrl={stall.photo}
          stallName={stall.name}
          onClose={() => setShowFullscreenImage(false)}
        />
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <RatingModal
          stall={stall}
          currentRating={userRating}
          onClose={() => setShowRatingModal(false)}
          onSubmit={async (rating) => {
            try {
              await rateStall(stall.id, currentUser.uid, rating);
              setUserRating(rating);
              // Reload ratings
              const ratings = await getStallRatings(stall.id);
              setAllRatings(ratings);
              setShowRatingModal(false);
              if (onRatingUpdate) onRatingUpdate();
            } catch (error) {
              console.error('Error submitting rating:', error);
              alert('Failed to submit rating. Please try again.');
            }
          }}
        />
      )}
        </div>
      </div>
    </>
  );
}

// Add Stall Modal
function AddStallModal({ userLocation, onClose, onSubmit }) {
  const [step, setStep] = useState('camera');
  const [photo, setPhoto] = useState(null);
  const [rating, setRating] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    console.log('Photo capture triggered:', file);
    
    if (file) {
      console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      // Compress and resize image
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Resize to max 1200px width while maintaining aspect ratio
          const maxWidth = 1200;
          const scale = maxWidth / img.width;
          canvas.width = img.width > maxWidth ? maxWidth : img.width;
          canvas.height = img.width > maxWidth ? img.height * scale : img.height;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Convert to compressed JPEG (70% quality)
          const compressedPhoto = canvas.toDataURL('image/jpeg', 0.7);
          
          console.log('Photo compressed:', {
            originalSize: file.size,
            compressedSize: compressedPhoto.length,
            reduction: `${((1 - compressedPhoto.length / file.size) * 100).toFixed(1)}%`
          });
          
          setPhoto(compressedPhoto);
          setStep('details');
        };
        img.src = e.target.result;
      };
      reader.onerror = (error) => {
        console.error('Error reading photo:', error);
        alert('Failed to load photo. Please try again.');
      };
      reader.readAsDataURL(file);
    } else {
      console.log('No file selected');
    }
  };

  const handleSubmit = () => {
    onSubmit({
      photo,
      rating,
      description,
      location: userLocation,
      addedBy: auth.currentUser?.uid || 'anonymous',
      ratings: 0,
      name: name || 'New Chai Stall'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 py-4 flex items-center justify-between border-b">
          <h2 className="text-xl font-bold">Add Chai Stall</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 'camera' ? (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Camera size={64} className="mx-auto text-amber-500 mb-3" />
                <p className="text-gray-700 font-medium text-lg">Add a photo of the chai stall</p>
              </div>

              {/* Camera Input */}
              <input
                id="photo-camera"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
              
              {/* Gallery Input */}
              <input
                id="photo-gallery"
                type="file"
                accept="image/*"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {/* Two separate buttons */}
              <div className="grid grid-cols-2 gap-3">
                <label 
                  htmlFor="photo-camera"
                  className="flex flex-col items-center justify-center border-2 border-amber-400 rounded-lg p-6 cursor-pointer active:bg-amber-50 transition"
                >
                  <Camera size={32} className="text-amber-500 mb-2" />
                  <span className="text-gray-700 font-medium">Camera</span>
                </label>

                <label 
                  htmlFor="photo-gallery"
                  className="flex flex-col items-center justify-center border-2 border-amber-400 rounded-lg p-6 cursor-pointer active:bg-amber-50 transition"
                >
                  <svg className="w-8 h-8 text-amber-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-700 font-medium">Gallery</span>
                </label>
              </div>

              <p className="text-center text-gray-500 text-sm mt-2">
                Choose how you want to add a photo
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative">
                <img src={photo} alt="Chai stall" className="w-full h-48 object-cover rounded-lg" />
                <label 
                  htmlFor="photo-input-change"
                  className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-lg cursor-pointer active:bg-gray-100"
                >
                  <Camera size={20} />
                </label>
                <input
                  id="photo-input-change"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
              </div>

              {/* Stall Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stall Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sharma Ji Chai, Raju Tea Stall"
                  maxLength="50"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">{name.length}/50 characters</p>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How was the chai?
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['Accha', 'Thik-Thak', 'Nahi'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRating(r)}
                      className={`py-3 rounded-lg font-semibold transition ${
                        rating === r
                          ? r === 'Accha' ? 'bg-green-500 text-white' :
                            r === 'Thik-Thak' ? 'bg-yellow-500 text-white' :
                            'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                      }`}
                    >
                      {r}!
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tell us about this chai (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Best cutting chai near the station..."
                  maxLength="150"
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{description.length}/150</p>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!rating}
                className="w-full bg-amber-600 text-white py-4 rounded-lg font-semibold active:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post Chai Stall
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Pin Placement Screen with Integrated Search
function PinPlacementScreen({ onConfirm, onCancel, userLocation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const autocompleteService = useRef(null);
  const placesService = useRef(null);
  const [map, setMap] = useState(null);
  const [centerCoords, setCenterCoords] = useState(userLocation);

  // Initialize Google Places Services
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      const mapDiv = document.createElement('div');
      const tempMap = new window.google.maps.Map(mapDiv);
      placesService.current = new window.google.maps.places.PlacesService(tempMap);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (window.google && userLocation) {
      const googleMap = new window.google.maps.Map(document.getElementById('pin-map'), {
        center: userLocation,
        zoom: 18,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
          }
        ]
      });

      setMap(googleMap);

      // Update coordinates as map moves
      googleMap.addListener('center_changed', () => {
        const center = googleMap.getCenter();
        setCenterCoords({
          lat: center.lat(),
          lng: center.lng()
        });
      });
    }
  }, [userLocation]);

  // Handle search query change
  const handleSearchChange = (query) => {
    setSearchQuery(query);

    if (query.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    if (autocompleteService.current) {
      autocompleteService.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'in' },
        },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
            setShowPredictions(true);
          } else {
            setPredictions([]);
            setShowPredictions(false);
          }
        }
      );
    }
  };

  // Handle place selection
  const handlePlaceSelect = (placeId) => {
    if (placesService.current && map) {
      placesService.current.getDetails(
        {
          placeId: placeId,
          fields: ['geometry', 'name'],
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry) {
            const location = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };

            // Smooth pan to location
            map.panTo(location);
            map.setZoom(18);

            setCenterCoords(location);
            setShowPredictions(false);
          }
        }
      );
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setPredictions([]);
    setShowPredictions(false);

    // Return to user location
    if (map && userLocation) {
      map.panTo(userLocation);
      setCenterCoords(userLocation);
    }
  };

  // Go to user location
  const handleMyLocation = () => {
    if (map && userLocation) {
      map.panTo(userLocation);
      map.setZoom(18);
      setCenterCoords(userLocation);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 safe-area-top">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onCancel}
            className="text-gray-600 font-medium"
          >
            Cancel
          </button>
          <h2 className="text-lg font-bold text-gray-800">Add Location</h2>
          <div className="w-16"></div>
        </div>

        {/* Search Box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search for a location..."
            className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showPredictions && predictions.length > 0 && (
          <div className="absolute left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-20">
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                onClick={() => handlePlaceSelect(prediction.place_id)}
                className="w-full px-4 py-3 hover:bg-gray-50 transition text-left border-b border-gray-100 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{prediction.structured_formatting.main_text}</p>
                    <p className="text-xs text-gray-600 truncate">{prediction.structured_formatting.secondary_text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider with Heading */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="text-sm text-gray-600 font-medium">Pin Point on Map</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div id="pin-map" className="w-full h-full"></div>

        {/* Fixed Pin in Center */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <MapPin
            size={48}
            className="text-red-600 drop-shadow-lg"
            fill="currentColor"
          />
        </div>

        {/* My Location Button */}
        <button
          onClick={handleMyLocation}
          className="absolute top-4 right-4 z-10 bg-white p-3 rounded-full shadow-lg hover:bg-gray-100 transition active:scale-95"
        >
          <Navigation size={20} className="text-blue-600" />
        </button>

        {/* Confirm Button */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-6 pt-4 bg-gradient-to-t from-white via-white to-transparent safe-area-bottom">
          <button
            onClick={() => centerCoords && onConfirm(centerCoords)}
            disabled={!centerCoords}
            className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            Confirm Location
          </button>

          {centerCoords && (
            <p className="text-xs text-gray-500 text-center mt-2">
              📍 {centerCoords.lat.toFixed(6)}, {centerCoords.lng.toFixed(6)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Admin Panel Component (Hidden - accessed by tapping profile image 5 times)
function AdminPanel({ onBack }) {
  const [betaUsers, setBetaUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBetaUsers = async () => {
    setLoading(true);
    const users = await getBetaUsers();
    // Sort: active users first, then by last active time
    users.sort((a, b) => {
      if (a.firstActiveAt && !b.firstActiveAt) return -1;
      if (!a.firstActiveAt && b.firstActiveAt) return 1;
      if (a.lastActiveAt && b.lastActiveAt) {
        return new Date(b.lastActiveAt.seconds * 1000) - new Date(a.lastActiveAt.seconds * 1000);
      }
      return 0;
    });
    setBetaUsers(users);
    setLoading(false);
  };

  useEffect(() => {
    loadBetaUsers();
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const usedAppUsers = betaUsers.filter(u => u.firstActiveAt);
  const neverUsedUsers = betaUsers.filter(u => !u.firstActiveAt);

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Beta User Tracking</h2>
              <p className="text-sm text-gray-600 mt-1">
                {usedAppUsers.length} used app • {neverUsedUsers.length} never opened
              </p>
            </div>
            <button
              onClick={loadBetaUsers}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Users Who Have Used The App */}
            {usedAppUsers.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="font-bold text-gray-900 mb-3 px-2">Have Used App</h3>
                {usedAppUsers.map((user) => (
                  <div
                    key={user.email}
                    className="flex items-center gap-3 px-2 py-3 border-b border-gray-100 last:border-0"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-bold text-lg">✓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{user.email}</p>
                      <p className="text-xs text-gray-500">
                        Last seen: {formatTime(user.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Users Who Never Opened */}
            {neverUsedUsers.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="font-bold text-gray-900 mb-3 px-2">Never Opened App</h3>
                {neverUsedUsers.map((user) => (
                  <div
                    key={user.email}
                    className="flex items-center gap-3 px-2 py-3 border-b border-gray-100 last:border-0"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 font-bold text-lg">○</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-600 truncate">{user.email}</p>
                      <p className="text-xs text-gray-400">Never opened the app</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Profile Page Component
function ProfilePage({ user, stalls, savedStallIds, onEditStall, onDeleteStall, onSignOut, onDeleteAccount }) {
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [currentView, setCurrentView] = useState('main'); // main, addedStalls, savedStalls, adminPanel
  const [tapCount, setTapCount] = useState(0);
  const [tapTimeout, setTapTimeout] = useState(null);
  const userStalls = stalls.filter(stall => stall.addedBy === user.uid);
  const savedStalls = stalls.filter(stall => savedStallIds?.includes(stall.id));

  const isAdmin = user.email === ADMIN_EMAIL;

  // Hidden admin access - 5 quick taps on profile image (admin only)
  const handleProfileImageTap = () => {
    if (!isAdmin) return; // Only admin can access

    if (tapTimeout) clearTimeout(tapTimeout);

    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= 5) {
      setCurrentView('adminPanel');
      setTapCount(0);
    } else {
      const timeout = setTimeout(() => setTapCount(0), 1000);
      setTapTimeout(timeout);
    }
  };

  const stallCounts = {
    total: userStalls.length,
    accha: userStalls.filter(s => s.rating === 'Accha').length,
    thikThak: userStalls.filter(s => s.rating === 'Thik-Thak').length,
    nahi: userStalls.filter(s => s.rating === 'Nahi').length
  };

  // Show different views based on currentView state
  if (currentView === 'addedStalls') {
    return (
      <AddedStallsView
        stalls={userStalls}
        onBack={() => setCurrentView('main')}
        onEditStall={onEditStall}
        onDeleteStall={onDeleteStall}
      />
    );
  }

  if (currentView === 'savedStalls') {
    return (
      <SavedStallsView
        stalls={savedStalls}
        onBack={() => setCurrentView('main')}
      />
    );
  }

  if (currentView === 'adminPanel') {
    return (
      <AdminPanel
        onBack={() => setCurrentView('main')}
      />
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 pb-24 space-y-6">

        {/* User Info Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-4">
            <img
              src={user.photoURL || 'https://via.placeholder.com/80'}
              alt={user.displayName}
              className={`w-20 h-20 rounded-full border-2 border-amber-200 ${isAdmin ? 'cursor-pointer' : ''}`}
              onClick={handleProfileImageTap}
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{user.displayName || 'Chai Lover'}</h2>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{stallCounts.total}</div>
              <div className="text-xs text-gray-600">Stalls</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stallCounts.accha}</div>
              <div className="text-xs text-gray-600">Accha</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stallCounts.thikThak}</div>
              <div className="text-xs text-gray-600">Thik-Thak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stallCounts.nahi}</div>
              <div className="text-xs text-gray-600">Nahi</div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* View Added Stalls */}
          <button
            onClick={() => setCurrentView('addedStalls')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <span className="text-lg">☕</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">View Added Stalls</p>
                <p className="text-sm text-gray-600">{userStalls.length} stall{userStalls.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Saved Stalls */}
          <button
            onClick={() => setCurrentView('savedStalls')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-lg">❤️</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Saved Stalls</p>
                <p className="text-sm text-gray-600">{savedStalls.length} stall{savedStalls.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Support Section */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Support Accha Chai ☕</h3>
          <p className="text-sm text-gray-700 mb-4">
            Help keep this project running and ad-free!
          </p>
          <button
            onClick={() => setShowSupportModal(true)}
            className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition"
          >
            Support This Project
          </button>
          <p className="text-xs text-center text-gray-600 mt-3">
            Built with ❤️ in India
          </p>
        </div>

        {/* Account Actions */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Account</h3>
          
          <button
            onClick={onSignOut}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            Logout
          </button>
          
          <button
            onClick={() => {
              if (window.confirm('⚠️ Delete your account?\n\nThis will:\n• Keep your stalls (they become community-owned)\n• Remove your name from them\n• Delete your account permanently\n\nThis cannot be undone.')) {
                onDeleteAccount();
              }
            }}
            className="w-full bg-red-50 text-red-600 py-3 rounded-lg font-semibold hover:bg-red-100 transition"
          >
            Delete Account
          </button>
        </div>

        <div className="text-center text-sm text-gray-500 pb-4">
          <p>Version 0.3 Beta</p>
          <p className="mt-1">
            Need help?{' '}
            <a
              href="mailto:nerdunsure+ping@gmail.com?subject=Accha%20Chai%20Support&body=Please%20don't%20edit%20the%20email%20address.%20Changing%20it%20may%20delay%20or%20prevent%20my%20reply.%0A%0A----%0A"
              className="text-blue-600 hover:underline"
            >
              Contact developer
            </a>
          </p>
        </div>
      </div>

      {/* Support Modal */}
      {showSupportModal && (
        <SupportModal onClose={() => setShowSupportModal(false)} />
      )}
    </div>
  );
}

// Edit Stall Modal
function EditStallModal({ stall, onClose, onSave }) {
  const [photo, setPhoto] = useState(stall.photo);
  const [rating, setRating] = useState(stall.rating);
  const [description, setDescription] = useState(stall.description || '');
  const [name, setName] = useState(stall.name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhoto(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!rating) {
      alert('Please select a rating!');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSave({
        ...stall,
        photo,
        rating,
        description,
        name: name || 'Chai Stall'
      });
    } catch (error) {
      console.error('Error updating stall:', error);
      alert('Failed to update stall. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 py-4 flex items-center justify-between border-b">
          <h2 className="text-xl font-bold">Edit Stall</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Photo */}
          <div className="relative">
            <img src={photo} alt="Chai stall" className="w-full h-48 object-cover rounded-lg" />
            <label 
              htmlFor="photo-input-edit"
              className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-lg cursor-pointer active:bg-gray-100"
            >
              <Camera size={20} />
            </label>
            <input
              id="photo-input-edit"
              type="file"
              accept="image/*"
              onChange={handlePhotoCapture}
              className="hidden"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stall Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sharma Ji Chai"
              maxLength="50"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How was the chai?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['Accha', 'Thik-Thak', 'Nahi'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  className={`py-3 rounded-lg font-semibold transition ${
                    rating === r
                      ? r === 'Accha' ? 'bg-green-500 text-white' :
                        r === 'Thik-Thak' ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                  }`}
                >
                  {r}!
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Best cutting chai near the station..."
              maxLength="150"
              rows="3"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">{description.length}/150</p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!rating || isSubmitting}
            className="w-full bg-amber-600 text-white py-4 rounded-lg font-semibold active:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Rating Modal
function RatingModal({ stall, currentRating, onClose, onSubmit }) {
  const [selectedRating, setSelectedRating] = useState(currentRating || '');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 flex items-center justify-between border-b">
          <h2 className="text-xl font-bold text-gray-800">Rate This Stall</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stall Info */}
          <div className="flex items-center gap-3 pb-4 border-b">
            <img
              src={stall.photo}
              alt={stall.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div>
              <h3 className="font-semibold text-gray-900">{stall.name}</h3>
              <p className="text-sm text-gray-600">{stall.description || 'Chai stall'}</p>
            </div>
          </div>

          {/* Rating Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How was the chai?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['Accha', 'Thik-Thak', 'Nahi'].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setSelectedRating(rating)}
                  className={`py-3 rounded-lg font-semibold transition ${
                    selectedRating === rating
                      ? rating === 'Accha' ? 'bg-green-500 text-white' :
                        rating === 'Thik-Thak' ? 'bg-yellow-500 text-white' :
                        'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {rating}!
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => onSubmit(selectedRating)}
            disabled={!selectedRating}
            className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentRating ? 'Update Rating' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Coming Soon Screen
function ComingSoonScreen({ title, icon}) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-6">
      <div className="text-center space-y-6">
        <div className="text-8xl mb-4">{icon}</div>
        <h2 className="text-3xl font-bold text-amber-900">{title}</h2>
        <p className="text-xl text-amber-800">Coming Soon!</p>
        <div className="space-y-2 pt-4">
          <p className="text-gray-700">We're working on exciting features:</p>
          <ul className="text-left text-gray-600 space-y-1 max-w-xs mx-auto">
            {title === 'Explore' && (
              <>
                <li>• Recent discoveries</li>
                <li>• Popular stalls</li>
                <li>• Filter by rating</li>
                <li>• Search nearby</li>
              </>
            )}
            {title === 'Profile' && (
              <>
                <li>• Your posted stalls</li>
                <li>• Chai points & badges</li>
                <li>• Favorites</li>
                <li>• Settings</li>
              </>
            )}
          </ul>
        </div>
        <p className="text-sm text-amber-700 pt-8">
          Stay tuned! ☕
        </p>
      </div>
    </div>
  );
}

// Added Stalls View
function AddedStallsView({ stalls, onBack, onEditStall, onDeleteStall }) {
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto pb-24">
        {/* Header */}
        <div className="sticky top-0 bg-white shadow-sm px-4 py-3 flex items-center gap-3 z-10">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800">Added Stalls</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          {stalls.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-3">☕</div>
              <p className="text-gray-600 font-medium">You haven't added any stalls yet</p>
              <p className="text-sm text-gray-500 mt-2">Click the + button to add your first stall!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stalls.map((stall) => {
                const isOld = (Date.now() - stall.createdAt?.toMillis?.()) > 7 * 24 * 60 * 60 * 1000;
                const isCommunityOwned = isOld;

                return (
                  <div key={stall.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    {/* Name */}
                    <h4 className="font-semibold text-lg text-gray-900 mb-2">
                      {stall.name || 'Chai Stall'}
                    </h4>

                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-white text-sm font-semibold ${
                        stall.rating === 'Accha' ? 'bg-green-500' :
                        stall.rating === 'Thik-Thak' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}>
                        {stall.rating}!
                      </span>
                      {isCommunityOwned && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Community-owned
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {stall.description && (
                      <p className="text-sm text-gray-600 mb-3">{stall.description}</p>
                    )}

                    {/* Photo Thumbnail */}
                    <div
                      onClick={() => setSelectedImage({ url: stall.photo, name: stall.name })}
                      className="cursor-pointer mb-3"
                    >
                      <img
                        src={stall.photo}
                        alt={stall.name || 'Chai stall'}
                        className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 hover:border-amber-400 transition"
                      />
                      <p className="text-xs text-gray-500 mt-1">Tap to view photo</p>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => onEditStall(stall)}
                        className="flex-1 bg-amber-100 text-amber-700 py-2 rounded-lg font-medium text-sm hover:bg-amber-200 transition"
                      >
                        Edit
                      </button>
                      {!isCommunityOwned ? (
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this stall? This cannot be undone.')) {
                              onDeleteStall(stall.id);
                            }
                          }}
                          className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg font-medium text-sm hover:bg-red-200 transition"
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => alert('This stall is community-owned and cannot be deleted. You can report issues if the stall is closed.')}
                          className="flex-1 bg-gray-100 text-gray-500 py-2 rounded-lg font-medium text-sm"
                          disabled
                        >
                          Can't Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {selectedImage && (
        <FullscreenImageViewer
          imageUrl={selectedImage.url}
          stallName={selectedImage.name}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

// Saved Stalls View
function SavedStallsView({ stalls, onBack }) {
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto pb-24">
        {/* Header */}
        <div className="sticky top-0 bg-white shadow-sm px-4 py-3 flex items-center gap-3 z-10">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800">Saved Stalls</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          {stalls.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-3">❤️</div>
              <p className="text-gray-600 font-medium">No saved stalls yet</p>
              <p className="text-sm text-gray-500 mt-2">Tap the heart icon on any stall to save it!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stalls.map((stall) => (
                <div key={stall.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  {/* Name */}
                  <h4 className="font-semibold text-lg text-gray-900 mb-2">
                    {stall.name || 'Chai Stall'}
                  </h4>

                  {/* Rating */}
                  <div className="mb-2">
                    <span className={`px-2 py-1 rounded-full text-white text-sm font-semibold ${
                      stall.rating === 'Accha' ? 'bg-green-500' :
                      stall.rating === 'Thik-Thak' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}>
                      {stall.rating}!
                    </span>
                  </div>

                  {/* Description */}
                  {stall.description && (
                    <p className="text-sm text-gray-600 mb-3">{stall.description}</p>
                  )}

                  {/* Photo Thumbnail */}
                  <div
                    onClick={() => setSelectedImage({ url: stall.photo, name: stall.name })}
                    className="cursor-pointer mb-3"
                  >
                    <img
                      src={stall.photo}
                      alt={stall.name || 'Chai stall'}
                      className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 hover:border-amber-400 transition"
                    />
                    <p className="text-xs text-gray-500 mt-1">Tap to view photo</p>
                  </div>

                  <button
                    onClick={() => {
                      const { lat, lng } = stall.location;
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                    }}
                    className="w-full mt-3 bg-blue-500 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2"
                  >
                    <Navigation size={16} />
                    Get Directions
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {selectedImage && (
        <FullscreenImageViewer
          imageUrl={selectedImage.url}
          stallName={selectedImage.name}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

// Support Modal
function SupportModal({ onClose }) {
  const targetAmount = 50000; // ₹50,000
  const contributedAmount = 12500; // ₹12,500
  const progressPercentage = (contributedAmount / targetAmount) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 flex items-center justify-between border-b">
          <h2 className="text-xl font-bold text-gray-800">Support Accha Chai</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Funding Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Funding Progress</span>
              <span className="text-sm font-semibold text-amber-600">{progressPercentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Raised: <span className="font-semibold text-gray-800">₹{contributedAmount.toLocaleString('en-IN')}</span></span>
              <span className="text-gray-600">Goal: <span className="font-semibold text-gray-800">₹{targetAmount.toLocaleString('en-IN')}</span></span>
            </div>
          </div>

          {/* What We'll Build */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">What Your Support Enables</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">☁️</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Server & Hosting</p>
                  <p className="text-sm text-gray-600">Keep the app fast and reliable for everyone</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">🗺️</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Google Maps API</p>
                  <p className="text-sm text-gray-600">Monthly costs for location services</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">🖼️</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Image Storage</p>
                  <p className="text-sm text-gray-600">Store all chai stall photos securely</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">✨</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">New Features</p>
                  <p className="text-sm text-gray-600">Explore feed, search, filters, and more</p>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4">
            <p className="text-sm text-gray-700 text-center mb-3">
              Want to contribute? Contact the developer to learn about sponsorship options.
            </p>
            <a
              href="mailto:nerdunsure+ping@gmail.com?subject=Support%20Accha%20Chai&body=Hi!%20I'd%20like%20to%20support%20the%20Accha%20Chai%20project.%0A%0A"
              className="block w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition text-center"
              onClick={onClose}
            >
              Get in Touch
            </a>
          </div>

          <p className="text-xs text-center text-gray-500">
            This is a community project. No ads, no premium features. Just authentic chai discovery.
          </p>
        </div>
      </div>
    </div>
  );
}

