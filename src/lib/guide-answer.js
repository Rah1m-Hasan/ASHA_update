import { retrieveKnowledge } from "../server/lib/retrieval.js";

// A reply built only from Asha's own versioned guide, with no AI model. It is used when cloud
// assistance is off, when there is no linked care circle and no network, or when every cloud
// model failed. It never invents facts: it quotes the guide or says what Asha can do.

const OVERVIEW = {
  en: "I can explain any part of Asha and help you ask for water, food, the toilet, comfort or your caregiver. You can talk with your face (FaceSpeak), eyes (EyeSpeak), hands (FingerSpeak) or voice (SenseAssist), follow guided exercise in Move, log meals in Nutrition, and see risk alerts with a prevention plan in Health outlook.",
  bn: "আমি Asha-র যেকোনো অংশ বুঝিয়ে দিতে পারি, আর পানি, খাবার, টয়লেট, আরাম বা কেয়ারগিভারকে ডাকতে সাহায্য করতে পারি। মুখ (FaceSpeak), চোখ (EyeSpeak), হাত (FingerSpeak) বা কণ্ঠ (SenseAssist) দিয়ে কথা বলতে পারেন, Move-এ ব্যায়াম, Nutrition-এ খাবার লেখা, আর Health outlook-এ ঝুঁকির সতর্কতা ও প্রতিরোধ পরিকল্পনা দেখতে পারেন।",
};

const TOPICS = [
  [/eye ?speak|eye typing|spell|চোখ দিয়ে লিখ/iu, "EyeSpeak lets you spell words or pick phrases by looking at large tiles; a slow blink or a steady look chooses, and nothing is sent until you confirm."],
  [/face ?speak|blink|smile|পলক|হাসি/iu, "FaceSpeak reads practised blinks, smiles and head movements as yes, no or a need. Each request opens a separate confirmation before your caregiver gets it."],
  [/finger ?speak|gesture|hand|হাত|আঙুল/iu, "FingerSpeak turns hand and finger gestures into requests, with a confirmation step before anything is sent."],
  [/vital|pulse|heart|breath|শ্বাস|নাড়ি|হৃদ/iu, "VitalSense gives an experimental camera estimate of pulse and breathing for awareness only. It is not a medical measurement; use a validated device for health decisions."],
  [/move|exercise|workout|ব্যায়াম/iu, "Move offers short guided routines with a safety check first. It stops and suggests rest if you report warning symptoms."],
  [/nutrition|meal|food log|calorie|kcal|খাবার লেখ|ক্যালরি/iu, "Nutrition logs a meal from a photo, an upload or a manual pick and shows a sourced calorie range. Photos are never stored."],
  [/risk|alert|outlook|heat|air|aqi|humid|weather|prevent|গরম|বায়ু|ঝুঁকি/iu, "Health outlook combines your recent signals with local heat, humidity and air quality, explains each alert, and suggests a prevention plan for today. It is decision support, not a diagnosis."],
  [/sense ?assist|speech|voice|কণ্ঠ|কথা/iu, "SenseAssist listens to unclear speech and suggests what you most likely said, for you to confirm. It never acts on a guess."],
];

const firstSentences = (text, n = 2) =>
  (String(text).match(/[^.!?।]+[.!?।]+/gu) || [String(text)])
    .slice(0, n)
    .join(" ")
    .trim();

/**
 * @param {{ query: string, module?: string, language?: string, reason?: "offline"|"cloud_off"|"cloud_failed" }} input
 * @returns {{ reply: string, sources: {id:string,title:string}[], answeredBy: "guide" }}
 */
export function guideAnswer({ query, module = "companion", language = "en" }) {
  const lang = language === "bn" || /[ঀ-৿]/u.test(query || "") ? "bn" : "en";
  const text = String(query || "").trim();
  const topic = TOPICS.find(([pattern]) => pattern.test(text));
  const sources = text ? retrieveKnowledge({ query: text, module, limit: 2 }) : [];
  const general = !text || /^(?:hi|hello|hey|help|what can you|who are you|what do you do|হ্যালো|হাই|তুমি কে|আপনি কে)/iu.test(text);
  let reply;
  if (general || (!topic && !sources.length)) reply = OVERVIEW[lang];
  else if (topic) reply = topic[1];
  else reply = firstSentences(sources[0].text);
  if (lang === "bn" && reply !== OVERVIEW.bn) reply = "Asha-র গাইড থেকে: " + reply;
  return {
    reply,
    sources: topic || general ? [] : sources.slice(0, 1).map(({ id, title }) => ({ id, title })),
    answeredBy: "guide",
  };
}
