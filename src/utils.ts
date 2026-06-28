const VULGAR_WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'cock', 'asshole', 
  'bastard', 'motherfucker', 'twit', 'wank', 'bollocks', 'crap', 'piss', 'slut', 'whore',
  'nigga', 'nigger', 'faggot', 'retard'
];

export function hasVulgarLanguage(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  
  // Replace all non-alphabetic characters with spaces to do boundary matching cleanly
  const cleanForBoundaries = normalized.replace(/[^a-z0-9]/g, ' ');
  
  for (const word of VULGAR_WORDS) {
    if (normalized.includes(word)) {
      return true;
    }
  }
  
  // Also check if they spaced out the letters, e.g. "f u c k"
  const lettersOnly = normalized.replace(/[^a-z]/g, '');
  for (const word of VULGAR_WORDS) {
    if (word.length >= 4 && lettersOnly.includes(word)) {
      return true;
    }
  }
  
  // Specific checks for "ass" with boundaries on the cleaned text to avoid false positives (e.g. "classic", "glass")
  const assRegex = /\bass\b|\basshole/i;
  if (assRegex.test(cleanForBoundaries) || assRegex.test(lettersOnly)) {
    return true;
  }
  
  return false;
}
