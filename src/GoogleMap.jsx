import React, { useRef, useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

// Load Places library
const libraries = ['places'];

// Helper function to get marker color based on average rating
const getMarkerColor = (stall) => {
  // Check if stall has enough ratings to show color
  const MIN_RATINGS_THRESHOLD = 7;
  const hasEnoughRatings = stall.ratingsCount >= MIN_RATINGS_THRESHOLD;

  if (!hasEnoughRatings || !stall.averageRating) {
    return '#6b7280'; // Gray for new/unrated stalls
  }

  const avgRating = stall.averageRating;

  // Map star ratings to colors (more vibrant for better visibility):
  // 4-5 stars: Vibrant Green (excellent/good)
  // 3 stars: Vibrant Yellow (average)
  // 1-2 stars: Vibrant Red (poor/below average)
  if (avgRating >= 4) {
    return '#10b981'; // Vibrant green (emerald-500)
  } else if (avgRating >= 3) {
    return '#f59e0b'; // Vibrant amber/yellow (amber-500)
  } else {
    return '#ef4444'; // Vibrant red (red-500)
  }
};

export default function Map({ stalls, userLocation, onStallClick }) {
  const mapRef = useRef(null);
  const locationButtonRef = useRef(null);
  const clustererRef = useRef(null);
  const markersRef = useRef([]);
  const [markersReady, setMarkersReady] = useState(0); // Counter to trigger clustering

  // Reset markers when stalls change
  useEffect(() => {
    markersRef.current = [];
  }, [stalls]);

  // Update clusterer when stalls or markers change
  useEffect(() => {
    // Wait for map and markers to be ready
    if (!mapRef.current || markersRef.current.length === 0) return;

    // Only initialize when we have all markers (stalls.length)
    if (markersRef.current.length < stalls.length) return;

    // Clear existing clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    // Initialize or re-initialize clusterer with all current markers
    const markers = markersRef.current.map(({ marker }) => marker);

    if (!clustererRef.current) {
      // Create new clusterer
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers,
        algorithmOptions: {
          maxZoom: 20,
          radius: 150,
        },
        renderer: {
          render: ({ count, position }) => {
            const zoom = mapRef.current.getZoom();
            let size, fontSize, strokeWidth;

            if (zoom <= 8) {
              size = 20;
              fontSize = 0;
              strokeWidth = 2;
            } else if (zoom <= 12) {
              size = 30;
              fontSize = 11;
              strokeWidth = 2;
            } else {
              size = 40;
              fontSize = 14;
              strokeWidth = 3;
            }

            return new window.google.maps.Marker({
              position,
              icon: {
                url: `data:image/svg+xml,${encodeURIComponent(`
                  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - strokeWidth}" fill="#f97316" stroke="white" stroke-width="${strokeWidth}"/>
                    ${fontSize > 0 ? `<text x="${size/2}" y="${size/2 + fontSize/3}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="white">${count}</text>` : ''}
                  </svg>
                `)}`,
                scaledSize: window.google?.maps ? new window.google.maps.Size(size, size) : undefined,
                anchor: window.google?.maps ? new window.google.maps.Point(size/2, size/2) : undefined,
              },
              zIndex: 1000 + count,
            });
          },
        },
      });

      // Listen for zoom changes
      mapRef.current.addListener('zoom_changed', () => {
        if (clustererRef.current) {
          clustererRef.current.render();
        }
      });
    } else {
      // Just add markers to existing clusterer
      clustererRef.current.addMarkers(markers);
    }
  }, [stalls, markersReady]);

  // Clean up clusterer when component unmounts
  useEffect(() => {
    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
      markersRef.current = [];
    };
  }, []);

  // Handle marker load - just store reference
  const handleMarkerLoad = (marker, stall) => {
    if (!markersRef.current.find(m => m.stall.id === stall.id)) {
      markersRef.current.push({ marker, stall });
      // Trigger clustering update
      setMarkersReady(prev => prev + 1);
    }
  };

  // Add custom control button when map is ready
  const handleMapLoad = (map) => {
    mapRef.current = map;

    // Wait for map to be fully idle before adding button
    window.google.maps.event.addListenerOnce(map, 'idle', () => {
      if (locationButtonRef.current) return; // Prevent duplicates

      // Create the button
      const locationButton = document.createElement('button');
      locationButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2.5">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      `;
      
      // Style to match Google Maps controls exactly
      Object.assign(locationButton.style, {
        backgroundColor: '#fff',
        border: 'none',
        outline: 'none',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        boxShadow: 'rgba(0, 0, 0, 0.3) 0px 1px 4px -1px',
        cursor: 'pointer',
        margin: '10px',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      // Hover effect
      locationButton.addEventListener('mouseenter', () => {
        locationButton.style.backgroundColor = '#ebebeb';
      });
      locationButton.addEventListener('mouseleave', () => {
        locationButton.style.backgroundColor = '#fff';
      });

      // Click handler
      locationButton.addEventListener('click', () => {
        if (userLocation) {
          map.panTo(userLocation);
          map.setZoom(15);
        }
      });

      // Add to map
      map.controls[window.google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);
      locationButtonRef.current = locationButton;
    });
  };

  // Loading state
  if (!userLocation) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-pulse">📍</div>
          <p className="text-gray-600">Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
      libraries={libraries}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={userLocation}
        zoom={14}
        onLoad={handleMapLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: window.google?.maps?.ControlPosition?.RIGHT_TOP
          },
          zoomControl: false,
          gestureHandling: 'greedy',  // Enable single-finger map movement
          // Keep the pan control visible
          panControl: true,
          panControlOptions: {
            position: window.google?.maps?.ControlPosition?.RIGHT_BOTTOM
          }
        }}
      >
        {/* User Location Marker */}
        <Marker
          position={userLocation}
          icon={{
            url: `data:image/svg+xml,${encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="white" stroke-width="3"/>
              </svg>
            `)}`,
          }}
        />

        {/* Chai Stall Markers */}
        {stalls.map((stall) => (
          <Marker
            key={stall.id}
            position={stall.location}
            onClick={() => onStallClick(stall)}
            onLoad={(marker) => handleMarkerLoad(marker, stall)}
            icon={{
              url: `data:image/svg+xml,${encodeURIComponent(`
                <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <filter id="shadow-${stall.id}" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
                    </filter>
                  </defs>
                  <circle cx="19" cy="19" r="16" fill="${getMarkerColor(stall)}" stroke="white" stroke-width="3" filter="url(#shadow-${stall.id})"/>
                  <text x="19" y="24" text-anchor="middle" font-size="18" fill="white">☕</text>
                </svg>
              `)}`,
              scaledSize: window.google?.maps ? new window.google.maps.Size(38, 38) : undefined,
              anchor: window.google?.maps ? new window.google.maps.Point(19, 19) : undefined,
            }}
          />
        ))}
      </GoogleMap>
    </LoadScript>
  );
}