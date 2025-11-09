import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Navigation, Star, Plus, X, ChevronDown, Menu, LogOut } from 'lucide-react';

// Mock Firebase - Replace with actual Firebase in production
const mockFirebase = {
  auth: {
    currentUser: null,
    signInWithPhoneNumber: async (phone) => {
      return {
        confirm: async (code) => {
          mockFirebase.auth.currentUser = { phoneNumber: phone, uid: '123' };
          return { user: mockFirebase.auth.currentUser };
        }
      };
    },
    signOut: async () => {
      mockFirebase.auth.currentUser = null;
    }
  },
  storage: [],
  stalls: []
};

// Main App Component
export default function AcchaChai() {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAddStall, setShowAddStall] = useState(false);
  const [selectedStall, setSelectedStall] = useState(null);
  const [stalls, setStalls] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Location error:', error)
      );
    }

    // Load existing stalls (mock data for demo)
    setStalls([
      {
        id: '1',
        name: 'Raju Chai Wala',
        location: { lat: 25.5941, lng: 85.1376 },
        rating: 'Accha',
        description: 'Best cutting chai near station',
        photo: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400',
        addedBy: 'user123',
        ratings: 12
      },
      {
        id: '2',
        name: 'Morning Glory Tea Stall',
        location: { lat: 25.5951, lng: 85.1386 },
        rating: 'Accha',
        description: 'Opens at 5 AM, strong masala chai',
        photo: 'https://images.unsplash.com/photo-1597318112240-dc4b48a75d3e?w=400',
        addedBy: 'user456',
        ratings: 8
      }
    ]);
  }, []);

  if (!user && !showAuth) {
    return <LandingScreen onLogin={() => setShowAuth(true)} />;
  }

  if (showAuth && !user) {
    return <AuthScreen onAuthComplete={(userData) => {
      setUser(userData);
      setShowAuth(false);
    }} />;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-amber-600 text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-2xl">☕</div>
          <h1 className="text-xl font-bold">Accha Chai</h1>
        </div>
        <button 
          onClick={() => {
            mockFirebase.auth.signOut();
            setUser(null);
          }}
          className="p-2 hover:bg-amber-700 rounded-lg transition"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Map View */}
      <div className="flex-1 relative">
        <MapView 
          stalls={stalls}
          userLocation={userLocation}
          onStallClick={setSelectedStall}
        />

        {/* FAB - Add Stall Button */}
        <button
          onClick={() => setShowAddStall(true)}
          className="absolute bottom-6 right-6 bg-amber-600 text-white rounded-full p-4 shadow-lg hover:bg-amber-700 transition"
        >
          <Plus size={28} />
        </button>

        {/* My Location Button */}
        {userLocation && (
          <button
            className="absolute bottom-6 left-6 bg-white text-gray-700 rounded-full p-3 shadow-lg hover:bg-gray-50 transition"
          >
            <Navigation size={24} />
          </button>
        )}
      </div>

      {/* Stall Detail Bottom Sheet */}
      {selectedStall && (
        <StallDetail 
          stall={selectedStall}
          onClose={() => setSelectedStall(null)}
        />
      )}

      {/* Add Stall Modal */}
      {showAddStall && (
        <AddStallModal
          userLocation={userLocation}
          onClose={() => setShowAddStall(false)}
          onSubmit={(newStall) => {
            setStalls([...stalls, { ...newStall, id: Date.now().toString() }]);
            setShowAddStall(false);
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

// Auth Screen
function AuthScreen({ onAuthComplete }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    setLoading(true);
    // Mock: In production, use Firebase
    setTimeout(() => {
      setStep('otp');
      setLoading(false);
    }, 1000);
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    // Mock: In production, verify with Firebase
    setTimeout(() => {
      onAuthComplete({ phoneNumber: phone, uid: '123' });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">☕</div>
          <h2 className="text-2xl font-bold text-gray-800">Welcome to Accha Chai</h2>
          <p className="text-gray-600 mt-2">
            {step === 'phone' ? 'Enter your phone number' : 'Enter OTP'}
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="flex gap-2">
                <div className="bg-gray-100 px-4 py-3 rounded-lg text-gray-700 font-medium">
                  +91
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  maxLength="10"
                />
              </div>
            </div>
            <button
              onClick={handleSendOTP}
              disabled={phone.length !== 10 || loading}
              className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter 6-digit OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center text-2xl tracking-widest"
                maxLength="6"
              />
            </div>
            <button
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || loading}
              className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full text-amber-600 py-2 text-sm hover:underline"
            >
              Change phone number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Map View Component
function MapView({ stalls, userLocation, onStallClick }) {
  return (
    <div className="w-full h-full bg-gray-200 relative">
      {/* Mock Map - In production, use Google Maps API */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-blue-100">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <MapPin size={48} className="mx-auto mb-2" />
            <p className="text-sm">Map View</p>
            <p className="text-xs mt-1">
              Integrate Google Maps API in production
            </p>
          </div>
        </div>

        {/* Mock Markers */}
        {stalls.map((stall) => (
          <button
            key={stall.id}
            onClick={() => onStallClick(stall)}
            className="absolute transform -translate-x-1/2 -translate-y-full"
            style={{
              left: `${50 + (Math.random() - 0.5) * 20}%`,
              top: `${50 + (Math.random() - 0.5) * 20}%`
            }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
              stall.rating === 'Accha' ? 'bg-green-500' :
              stall.rating === 'Thik-Thak' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}>
              <span className="text-white text-lg">☕</span>
            </div>
          </button>
        ))}

        {/* User Location */}
        {userLocation && (
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stall Detail Bottom Sheet
function StallDetail({ stall, onClose }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto">
      <div className="sticky top-0 bg-white px-4 py-3 flex items-center justify-between border-b">
        <div className="w-8"></div>
        <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Photo */}
        <img
          src={stall.photo}
          alt={stall.name}
          className="w-full h-48 object-cover rounded-lg"
        />

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
            {stall.ratings} ratings
          </span>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-bold text-lg text-gray-800 mb-2">{stall.name}</h3>
          <p className="text-gray-600">{stall.description}</p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button className="flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition">
            <Navigation size={20} />
            Get Directions
          </button>
          <button className="flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition">
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
  const fileInputRef = useRef(null);

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhoto(e.target.result);
        setStep('details');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      photo,
      rating,
      description,
      location: userLocation,
      addedBy: 'currentUser',
      ratings: 0,
      name: 'New Chai Stall'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-4 py-4 flex items-center justify-between border-b">
          <h2 className="text-xl font-bold">Add Chai Stall</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 'camera' ? (
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-amber-500 transition"
              >
                <Camera size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 font-medium">Tap to take photo</p>
                <p className="text-gray-400 text-sm mt-1">or select from gallery</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Photo Preview */}
              <div className="relative">
                <img src={photo} alt="Chai stall" className="w-full h-48 object-cover rounded-lg" />
                <button
                  onClick={() => setStep('camera')}
                  className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-lg"
                >
                  <Camera size={20} />
                </button>
              </div>

              {/* Rating Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How was the chai?
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['Accha', 'Thik-Thak', 'Nahi'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(r)}
                      className={`py-3 rounded-lg font-semibold transition ${
                        rating === r
                          ? r === 'Accha' ? 'bg-green-500 text-white' :
                            r === 'Thik-Thak' ? 'bg-yellow-500 text-white' :
                            'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!rating}
                className="w-full bg-amber-600 text-white py-4 rounded-lg font-semibold hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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