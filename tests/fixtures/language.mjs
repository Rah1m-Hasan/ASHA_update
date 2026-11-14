// Labelled language fixtures: heard speech pairs, intent queries and retrieval
// queries with the concept each one should reach.

/**
 * Heard → confirmed speech pairs, as a patient with dysarthria would produce
 * them. `expected` is the meaning the patient confirmed.
 */
export const speechPairs = [
  { heard: "wabbit", confirmed: "rabbit", expected: "rabbit" },
  { heard: "pwincess", confirmed: "princess", expected: "princess" },
  { heard: "woter", confirmed: "water", expected: "water" },
  { heard: "hungee", confirmed: "hungry", expected: "hungry" },
  { heard: "toilet", confirmed: "toilet", expected: "toilet" },
  { heard: "help me", confirmed: "help", expected: "help" },
  { heard: "paine", confirmed: "pain", expected: "pain" },
  { heard: "bathroom", confirmed: "bathroom", expected: "bathroom" },
  { heard: "ওয়াটার", confirmed: "পানি", expected: "পানি" },
  { heard: "খাবার", confirmed: "খাবার", expected: "খাবার" },
  { heard: "টয়লেট দরকার", confirmed: "টয়লেট", expected: "টয়লেট" },
];

/**
 * Messages with the caregiver request they imply, and messages that imply
 * none. The latter must never produce a request.
 */
export const intentCases = [
  { text: "I need water", expected: "water" },
  { text: "I want food please", expected: "food" },
  { text: "I need the toilet", expected: "toilet" },
  { text: "I need help", expected: "help" },
  { text: "water", expected: "water" },
  { text: "আমার পানি দরকার", expected: "water" },
  { text: "আমি খাবার চাই", expected: "food" },
  { text: "টয়লেট দরকার", expected: "toilet" },
  { text: "সাহায্য দরকার", expected: "help" },
  { text: "how do I use the eye board", expected: null },
  { text: "what is this app", expected: null },
  { text: "I do not need water", expected: null },
  { text: "no water please", expected: null },
  { text: "I need water and food", expected: null },
  { text: "for example I need water", expected: null },
  { text: "pretend I asked for water", expected: null },
];

/**
 * Retrieval queries with the concept ids that should rank for them. The ids
 * follow the `guide:<module>:<n>` shape the retriever emits.
 *
 * These are the queries the knowledge bundle can actually answer. A query the
 * bundle has no concept for belongs in `retrievalGapQueries` below, not here.
 */
export const retrievalQueries = [
  {
    query: "Can three quick blinks send water without confirmation?",
    expect: (id) => id.startsWith("guide:facespeak:"),
  },
  {
    query: "ক্যামেরা দিয়ে রক্তচাপ ও অক্সিজেন মাপা যায়?",
    expect: (id) => id.startsWith("guide:vitalsense:"),
  },
  {
    query: "both hands gesture practice",
    expect: (id) => id.startsWith("guide:fingerspeak:"),
  },
  {
    query: "চোখের পলক নিশ্চিতকরণ",
    expect: (id) => id.startsWith("guide:facespeak:"),
  },
  {
    query: "কথা বোঝা ও নিশ্চিতকরণ",
    expect: (id) => id.startsWith("guide:senseassist:"),
  },
  {
    query: "posture tilt and possible wake pattern",
    expect: (id) => id.startsWith("guide:posture:"),
  },
];

/**
 * Queries about a shipped module that the knowledge bundle has no concept
 * for. The bundle covers facespeak, fingerspeak, vitalsense, senseassist,
 * posture, companion, assessment and caregiver — but not EyeSpeak, so a
 * patient asking about the gaze pointer is answered with FaceSpeak text.
 *
 * These are measured and reported, not silently dropped. `expect` names the
 * module whose concept is missing.
 */
export const retrievalGapQueries = [
  {
    query: "How do I calibrate the gaze pointer?",
    module: "eyespeak",
  },
  {
    query: "eye board gaze selection with my eyes",
    module: "eyespeak",
  },
];
