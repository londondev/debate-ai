/**
 * Converts a debate title to a URL-friendly slug
 * @param title - The debate title
 * @returns URL-friendly slug
 */
export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extracts the debate ID from a slug-id combination
 * @param slugId - The slug-id combination (e.g., "should-ai-replace-humans-abc123")
 * @returns The debate ID
 */
export function extractIdFromSlug(slugId: string): string {
  // The ID is typically the last part after the last hyphen
  // We'll look for a pattern that looks like a Firebase ID (alphanumeric, 20+ chars)
  const parts = slugId.split('-');
  const lastPart = parts[parts.length - 1];
  
  // Firebase IDs are typically 20+ characters, alphanumeric
  if (lastPart && lastPart.length >= 15 && /^[a-zA-Z0-9]+$/.test(lastPart)) {
    return lastPart;
  }
  
  // Fallback: return the entire slugId if we can't extract an ID
  return slugId;
}