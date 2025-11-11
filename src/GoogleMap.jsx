import React, { useRef, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

// Helper function to get marker color
const getMarkerColor = (rating) => {
  switch (rating) {
    case 'Accha':
      return '#22c55e';
    case 'Thik-Thak':
      return '#eab308';
    case 'Nahi':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

export default function Map({ stalls, userLocation, onStallClick }) {
  const mapRef = useRef(null);
  const locationButtonRef = useRef(null);

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
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
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
            icon={{
              url: `data:image/svg+xml,${encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="14" fill="${getMarkerColor(stall.rating)}" stroke="white" stroke-width="2"/>
                  <text x="16" y="20" text-anchor="middle" font-size="16" fill="white">☕</text>
                </svg>
              `)}`,
            }}
          />
        ))}
      </GoogleMap>
    </LoadScript>
  );
}