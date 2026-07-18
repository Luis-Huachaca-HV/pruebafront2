/**
 * Extracts city, department/region, and country from a Mapbox place name
 * @param placeName Full place name from Mapbox geocoder
 * @returns Object with city, department, and country
 */
export interface LocationInfo {
  city: string;
  department: string;
  country: string;
  fullLocation: string;
}

export function extractLocationInfo(placeName: string): LocationInfo {
  if (!placeName) {
    return { city: '', department: '', country: '', fullLocation: '' };
  }

  const parts = placeName.split(',').map(p => p.trim());
  
  // Mapbox typically returns: Street, City, Region/Department, Country
  // We want: City, Department, Country (no street addresses)
  
  let city = '';
  let department = '';
  let country = '';

  if (parts.length >= 4) {
    // Format: Street, City, Department, Country - skip the street
    city = parts[parts.length - 3];
    department = parts[parts.length - 2];
    country = parts[parts.length - 1];
  } else if (parts.length === 3) {
    // Format: City, Department, Country
    city = parts[0];
    department = parts[1];
    country = parts[2];
  } else if (parts.length === 2) {
    // Format: Department, Country
    department = parts[0];
    country = parts[1];
  } else if (parts.length === 1) {
    city = parts[0];
  }

  // Show city, department and country (no street addresses)
  const fullLocation = [city, department, country].filter(Boolean).join(', ');

  return { city, department, country, fullLocation };
}

/**
 * Formats a location to show city, department/province and country (no street addresses)
 * @param placeName Full place name from Mapbox geocoder
 * @returns Formatted location string like "Camaná, Departamento de Arequipa, Perú"
 */
export function formatLocationShort(placeName: string): string {
  const { fullLocation } = extractLocationInfo(placeName);
  return fullLocation || placeName;
}
