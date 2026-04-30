/**
 * Parse a GHL meetingLocation string into { address, city }.
 *
 * GHL stores the location in one of these formats:
 *   1. Tab-separated:  "Street\t12345\tCity"
 *   2. Space-only:     "Street 12345 City"  (e.g. "Tingsvägen 17191 61 Sollentuna")
 *   3. Comma-separated: "Street, 553 15 City"
 *   4. Single value:   "Varies by event" / "ÄNDRA" → ignored
 */
export function parseGhlLocation(raw: string): { address: string | null; city: string | null } {
  const trimmed = raw.trim();

  // Ignore placeholder values
  if (!trimmed || trimmed.includes("ÄNDRA") || trimmed.includes("Varies")) {
    return { address: null, city: null };
  }

  // 1. Tab-separated: "Street\tZip\tCity"
  const tabParts = trimmed.split(/\t/).map((s) => s.trim()).filter(Boolean);
  if (tabParts.length >= 3) {
    const [street, zip, city] = tabParts;
    const formattedZip = /^\d{5}$/.test(zip) ? `${zip.slice(0, 3)} ${zip.slice(3)}` : zip;
    return { address: `${street}, ${formattedZip} ${city}`, city: city.trim() };
  }
  if (tabParts.length === 2) {
    return { address: `${tabParts[0]}, ${tabParts[1]}`, city: tabParts[1].trim() };
  }

  // 2. Comma-separated: "Street, Zip City" or "Street, City"
  if (trimmed.includes(",")) {
    const commaParts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    const city = commaParts[commaParts.length - 1];
    return { address: trimmed, city: city ?? null };
  }

  // 3. Space-only with embedded 5-digit zip: "Tingsvägen 17191 61 Sollentuna"
  // Strategy: find a 5-digit run (possibly split as "17191 61" = "17191" + "61")
  // More robustly: find a sequence of digits that together form 5 digits
  // Pattern: words before zip, zip (5 digits possibly split), city (last word)
  const spaceMatch = trimmed.match(/^(.+?)\s+(\d{3}\s?\d{2}|\d{5})\s+(.+)$/);
  if (spaceMatch) {
    const street = spaceMatch[1].trim();
    const zip = spaceMatch[2].replace(/\s/g, "");
    const city = spaceMatch[3].trim();
    const formattedZip = /^\d{5}$/.test(zip) ? `${zip.slice(0, 3)} ${zip.slice(3)}` : zip;
    return { address: `${street}, ${formattedZip} ${city}`, city };
  }

  // 4. Fallback: use last word as city
  const words = trimmed.split(/\s+/);
  const city = words[words.length - 1] ?? null;
  return { address: trimmed, city };
}
