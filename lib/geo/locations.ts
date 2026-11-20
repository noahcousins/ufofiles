/**
 * Static latitude/longitude lookup for known incident_location values.
 * Coordinates are [latitude, longitude] pairs.
 *
 * Each new release brings incident_location strings this table has never
 * seen, and an unknown string is silently left off the map. To cover one,
 * add a LOCATION_COORDS entry when it names a new place, or a
 * LOCATION_ALIASES entry when it is a variant, typo or list of known places.
 * The release orchestrator's verify step warns about unmapped strings.
 *
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
  "Caribbean Sea": [15.0, -75.0],
  "Gulf of America": [25.5, -90.0],

  // ── Countries ──────────────────────────────────────────────
  Afghanistan: [33.9, 68.7],
  Albania: [41.3, 20.2],
  Algeria: [28.0, 3.0],
  Australia: [-25.3, 133.8],
  Azerbaijan: [40.4, 49.9],
  Bahrain: [26.0, 50.5],
  Bangladesh: [23.7, 90.4],
  Belgium: [50.8, 4.0],
  Bhutan: [27.5, 90.4],
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
  Guam: [13.44, 144.79],
  Greece: [39.1, 21.8],
  Hungary: [47.16, 19.5],
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
  Nepal: [28.4, 84.1],
  Netherlands: [52.1, 5.3],
  Niger: [17.6, 8.1],
  Nigeria: [9.1, 8.7],
  "North Korea": [40.3, 127.5],
  Oman: [21.5, 55.9],
  Pakistan: [30.4, 69.3],
  Peru: [-9.19, -75.0],
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
  Sweden: [60.1, 18.6],
  Syria: [35.0, 38.0],
  Taiwan: [23.7, 120.96],
  Thailand: [15.9, 100.5],
  Tunisia: [34.0, 9.0],
  Turkey: [39.0, 35.2],
  Turkmenistan: [39.0, 59.6],
  "United Arab Emirates": [23.4, 53.8],
  "United Kingdom": [55.4, -3.4],
  USSR: [55.75, 37.62], // Moscow; Russia's centroid sits in Siberia
  Ukraine: [48.4, 31.2],
  Uzbekistan: [41.4, 64.6],
  Venezuela: [6.4, -66.6],
  Vietnam: [14.1, 108.3],
  Yemen: [15.5, 48.5],
  Zimbabwe: [-17.83, 31.05], // Harare

  // ── US locations ───────────────────────────────────────────
  "Detroit, MI": [42.33, -83.05],
  "Washington, D.C.": [38.91, -77.04],
  "New York": [40.71, -74.01],
  "Los Angeles": [34.05, -118.24],
  "San Diego": [32.72, -117.16],
  Nevada: [38.8, -116.4],
  California: [36.8, -119.4],
  Texas: [31.0, -100.0],
  Florida: [27.7, -81.7],
  Virginia: [37.4, -79.5],
  Alaska: [64.2, -149.5],
  Colorado: [39.0, -105.55],
  "Colorado Springs, Colorado": [38.83, -104.82],
  "Boston, Massachusetts": [42.36, -71.06],
  "Catalina Island, California": [33.39, -118.42],
  "Houston, Texas": [29.76, -95.37],
  Indiana: [40.0, -86.1],
  "Las Vegas, Nevada": [36.17, -115.14],
  Massachusetts: [41.9, -70.4], // Cape Cod side, clear of Boston
  Michigan: [44.3, -85.6],
  Montana: [47.0, -109.6],
  Nebraska: [41.5, -99.8],
  "New Jersey": [40.1, -74.5],
  "New Mexico": [34.5, -106.0],
  "San Francisco, California": [37.77, -122.42],
  "Tremonton, Utah": [41.71, -112.17],
  Utah: [39.3, -111.7],
  "Washington State": [47.4, -120.5],

  // ── Broad / meta regions ───────────────────────────────────
  "United States": [39.8, -98.6],
  "Southern United States": [32.0, -90.0],
  "Western United States": [40.0, -115.0],
  "Eastern United States": [40.0, -78.0],
  "Northeastern United States": [42.5, -73.5],
  "Southeastern United States": [33.0, -84.0],
  "Midwestern United States": [41.5, -90.0],
  "North America": [45.0, -100.0],
  "Middle East": [29.0, 47.0],
  "Pacific Time Zone": [38.0, -122.0],

  // ── Special locations ─────────────────────────────────────
  Moon: [28.6, -80.6], // Kennedy Space Center (launch site)
  "Low Earth Orbit": [28.6, -80.6],

  // ── Military / command regions ─────────────────────────────
  "Indo-PACOM": [21.3, -157.8], // HQ in Hawaii
  CENTCOM: [25.3, 51.4], // Area of responsibility center
  EUCOM: [48.7, 9.0],
  AFRICOM: [0.0, 20.0],
  SOUTHCOM: [10.0, -70.0],
  NORTHCOM: [40.0, -105.0],
}

/**
 * Raw incident_location strings that are not a LOCATION_COORDS key verbatim:
 * spelling variants and typos in the source CSV, and strings that name more
 * than one place (one marker per place). Keys are the exact DB strings.
 */
export const LOCATION_ALIASES: Record<string, string | string[]> = {
  // Variants and typos
  UAE: "United Arab Emirates",
  UK: "United Kingdom",
  INDOPACOM: "Indo-PACOM",
  "Washington, DC": "Washington, D.C.",
  "North Atlantic Ocean": "North Atlantic",
  "Low-Earth Orbit": "Low Earth Orbit",
  "Westen United States": "Western United States",
  "San Fransisco, California": "San Francisco, California",
  "Colorado Springs, Colorado, U.S.": "Colorado Springs, Colorado",
  "New Jersey, United States": "New Jersey",
  "Washington State, United States": "Washington State",
  // Release 8's lone "Washington" is Larson AFB, Moses Lake. D.C. is always
  // written "Washington, D.C." in the CSV.
  Washington: "Washington State",

  // A city filed under a country or region the table already has
  "Baku, Azerbaijan": "Azerbaijan",
  "Budapest, Hungary": "Hungary",
  "Harare, Zimbabwe": "Zimbabwe",
  "Bahia, Brazil": "Brazil",

  // Spaceflight, plotted at the launch site like the existing Moon/LEO pins.
  // The Cape Kennedy files are Gemini 5 and 7 debriefs (Earth orbit).
  "Cislunar Space": "Moon",
  "Cape Kennedy, Florida": "Low Earth Orbit",

  // Several places in one string
  "Ladakh, Nepal | Skkim, India | Bhutam": ["India", "Nepal", "Bhutan"],
  "Montana, Utah": ["Montana", "Utah"],
  "Northeastern U.S.; Afghanistan": [
    "Northeastern United States",
    "Afghanistan",
  ],
}

/**
 * Strings that deliberately have no point on the map. Listed so tooling can
 * tell them apart from strings nobody has mapped yet.
 */
export const UNMAPPABLE_LOCATIONS = new Set(["Various"])

/**
 * Resolve a raw incident_location string to the LOCATION_COORDS keys it
 * covers: itself, its alias target(s), or nothing when unknown.
 */
export function resolveLocation(name: string): string[] {
  // `hasOwn` guards so inherited Object.prototype members ("toString",
  // "constructor", …) don't resolve to a function.
  if (Object.hasOwn(LOCATION_COORDS, name)) {
    return [name]
  }
  if (Object.hasOwn(LOCATION_ALIASES, name)) {
    const target = LOCATION_ALIASES[name]
    return (Array.isArray(target) ? target : [target]).filter((key) =>
      Object.hasOwn(LOCATION_COORDS, key)
    )
  }
  return []
}
