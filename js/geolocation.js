// geolocation.js
// Promise wrapper around the browser Geolocation API with friendly errors.
// Geolocation requires HTTPS (GitHub Pages is HTTPS) and a user gesture.

/**
 * Request the user's current position.
 * @returns {Promise<{lat:number, lon:number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Your browser doesn't support location access."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: "Location permission was denied. You can still search by ZIP or city.",
          2: "Your location is unavailable right now. Try searching instead.",
          3: "Location request timed out. Try searching instead.",
        };
        reject(new Error(messages[err.code] || "Couldn't get your location."));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}
