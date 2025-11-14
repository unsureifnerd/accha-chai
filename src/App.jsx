import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Navigation, Star, Plus, X, LogOut, Phone, Share2 } from 'lucide-react';
import GoogleMapComponent from './GoogleMap';
import { addStall as saveStallToDb, getStalls, deleteStall, updateStall, saveStall, unsaveStall, getSavedStalls } from './firestore';
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
  const mapRef = useRef(null);

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
        console.error('Location permission denied:', error);
        alert('Location access is required to use Accha Chai. Please enable location in your browser settings.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    alert('Location services are not supported by your browser.');
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
      <header className="bg-amber-600 text-white px-4 py-3 shadow-md flex items-center justify-between safe-area-top">
        <div className="flex items-center gap-2">
          <div className="text-2xl">☕</div>
          <div>
            <h1 className="text-xl font-bold">Accha Chai</h1>
            <p className="text-xs text-amber-100">
              {user?.displayName || user?.email || 'Chai Explorer'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-2 hover:bg-amber-700 rounded-lg transition"
        >
          <LogOut size={20} />
        </button>
      </header>

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
                
                // Delete from betaUsers
                await deleteDoc(doc(db, 'betaUsers', user.email));
                
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

      {/* Pin Placement Modal */}
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

// Stall Detail Bottom Sheet
function StallDetail({ stall, onClose, savedStallIds, onToggleSave }) {
  const isSaved = savedStallIds?.includes(stall.id);

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
    <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto">
      <div className="sticky top-0 bg-white px-4 py-3 flex items-center justify-between border-b">
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
        <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <img
          src={stall.photo}
          alt={stall.name}
          className="w-full h-48 object-cover rounded-lg"
        />

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-white font-semibold ${
            stall.rating === 'Accha' ? 'bg-green-500' :
            stall.rating === 'Thik-Thak' ? 'bg-yellow-500' :
            'bg-red-500'
          }`}>
            {stall.rating}!
          </span>
          <span className="text-gray-600 text-sm">
            {stall.ratings} ratings
          </span>
        </div>

        <div>
          <h3 className="font-bold text-lg text-gray-800 mb-2">{stall.name}</h3>
          <p className="text-gray-600">{stall.description}</p>
        </div>

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
              alert('Rating feature coming soon! For now, add your own stall with your rating ☕');
            }}
            className="flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-lg font-semibold active:bg-amber-600 transition"
          >
            <Star size={20} />
            Rate Stall
          </button>
        </div>
      </div>
    </div>
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

// Pin Placement Screen
function PinPlacementScreen({ onConfirm, onCancel, userLocation }) {
  const [map, setMap] = useState(null);
  const [centerCoords, setCenterCoords] = useState(userLocation);

  useEffect(() => {
    // Initialize map
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

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white shadow-md p-4 safe-area-top">
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="text-gray-600 font-medium"
          >
            Cancel
          </button>
          <h2 className="text-lg font-bold text-gray-800">Pin Location</h2>
          <div className="w-16"></div>
        </div>
        <p className="text-sm text-gray-600 mt-2 text-center">
          Move the map to position the pin exactly on the stall
        </p>
      </div>

      {/* Map Container */}
      <div id="pin-map" className="w-full h-full"></div>

      {/* Fixed Pin in Center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <MapPin 
          size={48} 
          className="text-red-600 drop-shadow-lg"
          fill="currentColor"
        />
      </div>

      {/* Confirm Button */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-8 safe-area-bottom bg-white">
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
  );
}

// Profile Page Component
function ProfilePage({ user, stalls, savedStallIds, onEditStall, onDeleteStall, onSignOut, onDeleteAccount }) {
  const userStalls = stalls.filter(stall => stall.addedBy === user.uid);
  const savedStalls = stalls.filter(stall => savedStallIds?.includes(stall.id));
  
  const stallCounts = {
    total: userStalls.length,
    accha: userStalls.filter(s => s.rating === 'Accha').length,
    thikThak: userStalls.filter(s => s.rating === 'Thik-Thak').length,
    nahi: userStalls.filter(s => s.rating === 'Nahi').length
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-6 pb-24 space-y-6">
        
        {/* User Info Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-4">
            <img 
              src={user.photoURL || 'https://via.placeholder.com/80'} 
              alt={user.displayName}
              className="w-20 h-20 rounded-full border-2 border-amber-200"
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

        {/* My Stalls */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">My Stalls ({userStalls.length})</h3>
          
          {userStalls.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-3">☕</div>
              <p className="text-gray-600">You haven't added any stalls yet</p>
              <p className="text-sm text-gray-500 mt-2">Click the + button to add your first stall!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userStalls.map((stall) => {
                const isOld = (Date.now() - stall.createdAt?.toMillis?.()) > 7 * 24 * 60 * 60 * 1000; // 7 days
                const isCommunityOwned = isOld; // Simple rule for now
                
                return (
                  <div key={stall.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex gap-3">
                      <img 
                        src={stall.photo} 
                        alt={stall.name || 'Chai stall'}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {stall.name || 'Chai Stall'}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">{stall.description || 'No description'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-sm font-medium ${
                            stall.rating === 'Accha' ? 'text-green-600' :
                            stall.rating === 'Thik-Thak' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {stall.rating}!
                          </span>
                          {isCommunityOwned && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Community-owned
                            </span>
                          )}
                        </div>
                      </div>
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

        {/* Saved Stalls */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Saved Stalls ({savedStalls.length})</h3>
          
          {savedStalls.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-3">❤️</div>
              <p className="text-gray-600">No saved stalls yet</p>
              <p className="text-sm text-gray-500 mt-2">Tap the heart icon on any stall to save it!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedStalls.map((stall) => (
                <div key={stall.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <img 
                      src={stall.photo} 
                      alt={stall.name || 'Chai stall'}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {stall.name || 'Chai Stall'}
                      </h4>
                      <p className="text-sm text-gray-600 truncate">{stall.description || 'No description'}</p>
                      <span className={`text-sm font-medium ${
                        stall.rating === 'Accha' ? 'text-green-600' :
                        stall.rating === 'Thik-Thak' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stall.rating}!
                      </span>
                    </div>
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

        {/* Support Section */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Support Accha Chai ☕</h3>
          <p className="text-sm text-gray-700 mb-4">
            Help keep this project running and ad-free!
          </p>
          <div className="space-y-2">
            <button
              onClick={() => alert('Thank you for your support! ❤️\n\nDonation feature coming soon.')}
              className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition"
            >
              ☕ Buy Me a Chai
            </button>
            <p className="text-xs text-center text-gray-600">
              Built with ❤️ in India
            </p>
          </div>
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
          <p>Version 0.2 Beta</p>
          <p className="mt-1">Need help? Contact developer</p>
        </div>
      </div>
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

// Coming Soon Screen
function ComingSoonScreen({ title, icon }) {
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