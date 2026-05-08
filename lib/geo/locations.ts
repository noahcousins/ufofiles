/**
 * Static latitude/longitude lookup for known incident_location values.
 * Coordinates are [latitude, longitude] pairs.
 *
 * To add a new location, simply add a new entry to LOCATION_COORDS.
 * Run: SELECT DISTINCT incident_location FROM files WHERE incident_location IS NOT NULL
 *      AND incident_location != '' AND incident_location != 'N/A'
 *      ORDER BY incident_location;
 */
export const LOCATION_COORDS: Record<string, [number, number]> = {
  // ── Bodies of water / maritime regions ──────────────────────
  "Aegean Sea": [39.0, 25.0],
  "Arabian Gulf": [26.0, 51.0],
  "Arabian Sea": [15.0, 65.0],
  "East China Sea": [30.0, 126.0],
  "Gulf of Aden": [12.5, 47.0],
  "Gulf of Oman": [24.5, 58.5],
  "Indian Ocean": [-10.0, 75.0],
  "Mediterranean Sea": [35.0, 18.0],
  "Pacific Ocean": [0.0, -160.0],
  "Persian Gulf": [26.0, 51.0],
  "Red Sea": [20.0, 38.0],
  "South China Sea": [12.0, 114.0],
  "Strait of Hormuz": [26.5, 56.5],
  "Sea of Japan": [40.0, 135.0],
  "Black Sea": [43.0, 34.0],
  "Caspian Sea": [41.0, 51.0],
  "North Atlantic": [45.0, -30.0],
  "South Atlantic": [-25.0, -15.0],
  "North Pacific": [35.0, -170.0],
  "South Pacific": [-20.0, -140.0],
  "Atlantic Ocean": [25.0, -40.0],
  "Baltic Sea": [58.0, 20.0],
  "Yellow Sea": [35.0, 123.0],

  // ── Countries ──────────────────────────────────────────────
  Afghanistan: [33.9, 68.7],
  Albania: [41.3, 20.2],
  Algeria: [28.0, 3.0],
  Azerbaijan: [40.4, 49.9],
  Bahrain: [26.0, 50.5],
  Bangladesh: [23.7, 90.4],
  Belgium: [50.8, 4.0],
  Brazil: [-14.2, -51.9],
  Canada: [56.1, -106.3],
  China: [35.9, 104.2],
  Colombia: [4.6, -74.1],
  Cuba: [21.5, -80.0],
  Djibouti: [11.6, 43.1],
  Egypt: [26.8, 30.8],
  Ethiopia: [9.1, 40.5],
  France: [46.6, 2.2],
  Georgia: [42.3, 43.4],
  Germany: [51.2, 10.4],
  Greece: [39.1, 21.8],
  India: [20.6, 78.9],
  Indonesia: [-0.8, 113.9],
  Iran: [32.4, 53.7],
  Iraq: [33.2, 43.7],
  Israel: [31.0, 34.9],
  Italy: [41.9, 12.6],
  Japan: [36.2, 138.3],
  Jordan: [30.6, 36.2],
  Kazakhstan: [48.0, 68.0],
  Kenya: [0.0, 38.0],
  Kuwait: [29.3, 47.5],
  Lebanon: [33.9, 35.9],
  Libya: [26.3, 17.2],
  Malaysia: [4.2, 101.9],
  Mexico: [23.6, -102.6],
  Morocco: [31.8, -7.1],
  Netherlands: [52.1, 5.3],
  Niger: [17.6, 8.1],
  Nigeria: [9.1, 8.7],
  "North Korea": [40.3, 127.5],
  Oman: [21.5, 55.9],
  Pakistan: [30.4, 69.3],
  "Papua New Guinea": [-6.3, 143.9],
  Philippines: [12.9, 121.8],
  Poland: [51.9, 19.1],
  Qatar: [25.3, 51.2],
  Romania: [45.9, 25.0],
  Russia: [61.5, 105.3],
  "Saudi Arabia": [23.9, 45.1],
  Somalia: [5.2, 46.2],
  "South Korea": [35.9, 127.8],
  Spain: [40.5, -3.7],
  Sudan: [12.9, 30.2],
  Syria: [35.0, 38.0],
  Taiwan: [23.7, 120.96],
  Thailand: [15.9, 100.5],
  Tunisia: [34.0, 9.0],
  Turkey: [39.0, 35.2],
  Turkmenistan: [39.0, 59.6],
  UAE: [23.4, 53.8],
  "United Arab Emirates": [23.4, 53.8],
  UK: [55.4, -3.4],
  "United Kingdom": [55.4, -3.4],
  Ukraine: [48.4, 31.2],
  Uzbekistan: [41.4, 64.6],
  Venezuela: [6.4, -66.6],
  Vietnam: [14.1, 108.3],
  Yemen: [15.5, 48.5],

  // ── US locations ───────────────────────────────────────────
  "Detroit, MI": [42.33, -83.05],
  "Washington, DC": [38.91, -77.04],
  "New York": [40.71, -74.01],
  "Los Angeles": [34.05, -118.24],
  "San Diego": [32.72, -117.16],
  Nevada: [38.8, -116.4],
  California: [36.8, -119.4],
  Texas: [31.0, -100.0],
  Florida: [27.7, -81.7],
  Virginia: [37.4, -79.5],

  // ── Broad / meta regions ───────────────────────────────────
  "United States": [39.8, -98.6],
  "Southern United States": [32.0, -90.0],
  "Western United States": [40.0, -115.0],
  "North America": [45.0, -100.0],
  "Middle East": [29.0, 47.0],
  "Pacific Time Zone": [38.0, -122.0],

  // ── Special locations ─────────────────────────────────────
  Moon: [28.6, -80.6], // Kennedy Space Center (launch site)
  "Low Earth Orbit": [28.6, -80.6],

  // ── Military / command regions ─────────────────────────────
  "Indo-PACOM": [21.3, -157.8], // HQ in Hawaii
  INDOPACOM: [21.3, -157.8],
  CENTCOM: [25.3, 51.4], // Area of responsibility center
  EUCOM: [48.7, 9.0],
  AFRICOM: [0.0, 20.0],
  SOUTHCOM: [10.0, -70.0],
  NORTHCOM: [40.0, -105.0],
}

/**
 * Look up coordinates for a location name.
 * Returns [latitude, longitude] or null if not found.
 */
export function geocodeLocation(name: string): [number, number] | null {
  return LOCATION_COORDS[name] ?? null
}
