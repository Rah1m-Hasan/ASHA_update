// Bangla for the short cues the detectors produce, so the one on-screen correction and the spoken
// cue follow the chosen language. Unknown strings fall back to English rather than a guess.

const BN = {
  "Lower a little more": "আরেকটু নামুন",
  "Stand all the way up": "পুরোপুরি উঠে দাঁড়ান",
  "Lower toward the seat": "আসনের দিকে নামুন",
  "Stand tall again": "আবার সোজা হয়ে দাঁড়ান",
  "Sit back down slowly": "ধীরে আবার বসুন",
  "Stand up fully": "পুরোপুরি উঠে দাঁড়ান",
  "Bend your elbows a little more": "কনুই আরেকটু ভাঁজ করুন",
  "Push back until your arms are nearly straight": "হাত প্রায় সোজা না হওয়া পর্যন্ত পেছনে ঠেলুন",
  "Lower your arm slowly": "ধীরে হাত নামান",
  "Raise to shoulder height": "কাঁধের উচ্চতা পর্যন্ত তুলুন",
  "Lower your heels slowly": "ধীরে গোড়ালি নামান",
  "Rise onto your toes": "পায়ের আঙুলের ওপর উঠুন",
  "Lower your foot slowly": "ধীরে পা নামান",
  "Straighten your knee to the set range": "নির্ধারিত সীমা পর্যন্ত হাঁটু সোজা করুন",
  "Straighten your arm slowly": "ধীরে হাত সোজা করুন",
  "Bend your elbow to the set range": "নির্ধারিত সীমা পর্যন্ত কনুই ভাঁজ করুন",
  "Raise your arm to the set range": "নির্ধারিত সীমা পর্যন্ত হাত তুলুন",
  Counted: "গোনা হয়েছে",
  "Get into the start position": "শুরুর অবস্থানে আসুন",
  "Stand still with your feet flat": "পা সমান রেখে স্থির দাঁড়ান",
  "Smile a little more": "আরেকটু হাসুন",
  "Lift your eyebrows a little higher": "ভ্রু আরেকটু উপরে তুলুন",
  "Puff a little more air into your cheeks": "গালে আরেকটু বাতাস নিন",
  "Relax your face": "মুখ শিথিল করুন",
  "Now relax": "এবার শিথিল হন",
  "Hold it": "ধরে রাখুন",
  "Keep a relaxed face for a moment": "এক মুহূর্ত মুখ শিথিল রাখুন",
  "Relax your face to start": "শুরু করতে মুখ শিথিল করুন",
  "Close your hand gently": "আলতো করে হাত বন্ধ করুন",
  "Open all your fingers": "সব আঙুল খুলুন",
  "Close your hand gently to start": "শুরু করতে আলতো করে হাত বন্ধ করুন",
  "Not counted: open your fingers a little wider.": "গোনা হয়নি: আঙুল আরেকটু খুলুন।",
  "Make a straight line from your shoulders to your knees": "কাঁধ থেকে হাঁটু পর্যন্ত সোজা রেখা করুন",
  "Hold steady and keep breathing": "স্থির থাকুন ও শ্বাস নিতে থাকুন",
  "Waiting for the camera": "ক্যামেরার অপেক্ষা",
  "No camera frames": "ক্যামেরার ছবি আসছে না",
  "Can't see your body. Step into the camera view.": "শরীর দেখা যাচ্ছে না। ক্যামেরার সামনে আসুন।",
  "Keep only one person in view.": "ছবিতে শুধু একজন থাকুন।",
  "Move back so your whole body stays inside the frame.": "পেছনে সরুন যাতে পুরো শরীর ছবির ভেতরে থাকে।",
  "Turn side-on so your joints don't overlap.": "পাশ ফিরে দাঁড়ান যাতে জয়েন্টগুলো একটার ওপর আরেকটা না পড়ে।",
  "Can't see your face. Face the camera in good light.": "মুখ দেখা যাচ্ছে না। ভালো আলোয় ক্যামেরার দিকে তাকান।",
  "Face the camera straight on.": "সরাসরি ক্যামেরার দিকে তাকান।",
  "Show your hand to the camera, palm facing it.": "হাতের তালু ক্যামেরার দিকে রেখে হাত দেখান।",
  "Keep your whole hand, fingertips too, inside the picture.": "আঙুলের ডগাসহ পুরো হাত ছবির ভেতরে রাখুন।",
  "Keep your shoulders, elbows and hips in view.": "কাঁধ, কনুই ও নিতম্ব দেখা যায় এমনভাবে থাকুন।",
  "Keep your shoulders, hips and knees in view, side-on to the camera.": "পাশ ফিরে কাঁধ, নিতম্ব ও হাঁটু দেখা যায় এমনভাবে থাকুন।",
};

// What the workout says out loud (session announcements), in Bangla.
const SAY_BN = {
  "Warm up: march gently in place or seated, roll your shoulders and breathe normally.": "ওয়ার্ম-আপ: দাঁড়িয়ে বা বসে আলতো করে পা ফেলুন, কাঁধ ঘোরান, স্বাভাবিকভাবে শ্বাস নিন।",
  "Set up your camera so ASHA can see the parts of you this exercise needs.": "ক্যামেরা এমনভাবে রাখুন যাতে এই ব্যায়ামের জন্য দরকারি অংশগুলো আশা দেখতে পায়।",
  "Manual counting: tap once for each repetition you finish.": "নিজে গোনা: প্রতিবার শেষ করলে একবার চাপুন।",
  "Practice: get into position and hold for a moment. This isn't counted.": "অনুশীলন: অবস্থানে আসুন ও এক মুহূর্ত ধরে রাখুন। এটি গোনা হবে না।",
  "Practice: try one repetition. It isn't counted.": "অনুশীলন: একবার চেষ্টা করুন। এটি গোনা হবে না।",
  "Rest is over. Tap Next when you're ready, or rest a little longer.": "বিশ্রাম শেষ। প্রস্তুত হলে \"পরের\" চাপুন, বা আরেকটু বিশ্রাম নিন।",
  "Great, that's the position. It wasn't timed. Tap Start counting when you're ready.": "চমৎকার, এটাই অবস্থান। এটি সময় গোনা হয়নি। প্রস্তুত হলে \"গোনা শুরু\" চাপুন।",
  "Tracking again. The unfinished repetition was not counted.": "আবার দেখা যাচ্ছে। অসমাপ্ত বারটি গোনা হয়নি।",
  "Well done. Cool down: walk or march slowly and breathe easily.": "দারুণ। কুল-ডাউন: ধীরে হাঁটুন বা পা ফেলুন, সহজভাবে শ্বাস নিন।",
  "Paused.": "বিরতি।",
  "Resumed.": "আবার শুরু।",
  "Stopping this exercise. Don't push through sharp pain.": "এই ব্যায়াম থামানো হচ্ছে। তীব্র ব্যথা নিয়ে চালিয়ে যাবেন না।",
  "Let's ease off. Cool down slowly.": "চলুন একটু থামি। ধীরে কুল-ডাউন করুন।",
  "Stop exercising and get urgent medical help now.": "ব্যায়াম থামান এবং এখনই জরুরি চিকিৎসা সহায়তা নিন।",
  "Stop and rest.": "থামুন এবং বিশ্রাম নিন।",
};
const SAY_PATTERNS = [
  [/^Next: (.+)\. Watch how it's done, then tap Ready\.$/, (m) => `এরপর: ${m[1]}। কীভাবে করতে হয় দেখুন, তারপর "প্রস্তুত" চাপুন।`],
  [/^Practice: try (\d+) repetitions\. They aren't counted\.$/, (m) => `অনুশীলন: ${m[1]} বার চেষ্টা করুন। এগুলো গোনা হবে না।`],
  [/^Great, that's practice (\d+)\. It wasn't counted\.( Tap Start counting when you're ready\.)?$/, (m) => `চমৎকার, এটি অনুশীলন ${m[1]}। গোনা হয়নি।${m[2] ? ' প্রস্তুত হলে "গোনা শুরু" চাপুন।' : ""}`],
  [/^(.+)\. Set (\d+) of (\d+): (\d+) seconds\.$/, (m) => `${m[1]}। সেট ${m[2]} / ${m[3]}: ${m[4]} সেকেন্ড।`],
  [/^(.+)\. Set (\d+) of (\d+): (\d+) repetitions\.$/, (m) => `${m[1]}। সেট ${m[2]} / ${m[3]}: ${m[4]} বার।`],
  [/^Rest for (\d+) seconds\.$/, (m) => `${m[1]} সেকেন্ড বিশ্রাম নিন।`],
  [/^Resting (\d+) seconds longer\.$/, (m) => `আরও ${m[1]} সেকেন্ড বিশ্রাম।`],
];

/** A workout announcement in the chosen language. Counts (plain numbers) pass through. */
export function sayText(text, lang) {
  if (!text || lang !== "bn") return text ?? "";
  if (SAY_BN[text]) return SAY_BN[text];
  for (const [re, fn] of SAY_PATTERNS) {
    const m = re.exec(text);
    if (m) return fn(m);
  }
  return text;
}

/** A detector cue in the chosen language. */
export function cueText(reason, lang) {
  if (!reason || lang !== "bn") return reason ?? "";
  if (BN[reason]) return BN[reason];
  const m = /^Not counted: (.+?)( or hold a little longer)?\.$/.exec(reason);
  if (m) {
    const inner = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    const bn = BN[inner];
    if (bn) return `গোনা হয়নি: ${bn}${m[2] ? " বা আরেকটু ধরে রাখুন" : ""}।`;
  }
  return reason;
}
