/**
 * How close a suggested meaning is to the words that were actually heard.
 *
 * The clarification model is asked to guess what the patient said, sound by
 * sound. A guess that has drifted away from the heard words is not a
 * reading of those words, it is a different sentence - so it is checked
 * here before the patient is asked to confirm it.
 *
 * Two things are compared. How many of the words are shared catches a
 * candidate that is part of what was said ("water" for "I want water"). How
 * far the two strings are apart catches the sound-alike edits the model is
 * asked to make ("wabbit" for "rabbit"). Both work in Bangla and in English,
 * because the comparison is on characters and words, not on a word list.
 */

/** Words that carry no meaning on their own, so they cannot make a candidate plausible. */
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "for",
  "from", "had", "has", "have", "i", "in", "is", "it", "me", "my", "no",
  "not", "of", "on", "or", "our", "please", "so", "that", "the", "their",
  "them", "there", "these", "they", "this", "to", "was", "we", "were",
  "what", "will", "with", "you", "your",
]);

/** How close two readings have to be before the patient is asked to confirm one. */
export const SPEECH_MATCH_THRESHOLD = 0.62;

/** Lower case, drop punctuation, keep letters and numbers in any script. */
export function normaliseSpeech(text) {
  return String(text ?? "")
    .toLowerCase()
    // \p{M} keeps the combining vowel signs Bangla uses.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** The words in a phrase that carry meaning. */
export function contentWords(text) {
  return normaliseSpeech(text)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * How close two readings are, from 0 (nothing in common) to 1 (the same
 * words). The closer of the two tests wins: a candidate that shares the
 * words, and a candidate that is the same words with a different sound.
 */
export function speechSimilarity(heard, candidate) {
  const a = normaliseSpeech(heard);
  const b = normaliseSpeech(candidate);
  if (!a || !b) return 0;
  const edit = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);
  const counts = new Map();
  for (const token of tokensA) counts.set(token, (counts.get(token) || 0) + 1);
  let shared = 0;
  for (const token of tokensB) {
    const left = counts.get(token) || 0;
    if (left > 0) {
      shared += 1;
      counts.set(token, left - 1);
    }
  }
  // The words of the shorter reading that also appear in the longer one.
  const coverage = tokensA.length && tokensB.length
    ? shared / Math.min(tokensA.length, tokensB.length)
    : 0;
  return Math.max(edit, coverage);
}

/**
 * Whether a candidate is a reading of what was heard. `alternatives` are the
 * recogniser's other readings of the same audio: a candidate that matches
 * one of them is a reading of the same words.
 */
export function candidateMatchesHeard(heard, candidate, alternatives = []) {
  if (!contentWords(candidate).length) return false;
  if (speechSimilarity(heard, candidate) >= SPEECH_MATCH_THRESHOLD) return true;
  for (const alternative of Array.isArray(alternatives) ? alternatives : []) {
    if (
      alternative &&
      speechSimilarity(alternative, candidate) >= SPEECH_MATCH_THRESHOLD
    )
      return true;
  }
  return false;
}
