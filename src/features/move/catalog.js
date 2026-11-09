// ASHA Move exercise library. Data, not screens: every program and session is built from these
// versioned definitions. "tracked" exercises have a deterministic camera detector in detectors.js;
// everything else is manual (the person logs it) until a detector passes evaluation.
// Demonstration media is intentionally absent: no licensed illustrations are bundled yet.

export const CATALOG_VERSION = "2026.11.0";

/** @typedef {"face"|"upper_body"|"lower_body"|"core"|"full_body"|"mobility"|"rehab"} Category */
/** @typedef {"reps"|"timed_hold"|"duration"|"manual_log"} ExerciseKind */
/** @typedef {"face_blendshape"|"pose_landmarks"|"manual"|"clinician_record"} TrackingMethod */

/**
 * @typedef {Object} ExerciseDefinition
 * @property {string} id
 * @property {string} version
 * @property {string} title
 * @property {string} titleBn
 * @property {Category} category
 * @property {"wellness"|"clinician_assigned"} intendedUse
 * @property {ExerciseKind} kind
 * @property {TrackingMethod} trackingMethod
 * @property {"demo"|"benchmarked"|"clinically_validated"} validationLevel
 * @property {string} area
 * @property {string[]} steps
 * @property {string[]} stepsBn
 * @property {string[]} equipment
 * @property {"beginner"|"intermediate"|"advanced"} difficulty
 * @property {"front"|"side"|"three_quarter"} [cameraView]
 * @property {string[]} stopCues
 * @property {string[]} screeningFlags
 * @property {string[]} alternatives
 * @property {string} limitation
 * @property {boolean} [specialist]
 * @property {{sets:number, targetReps?:number, holdSeconds?:number, durationSeconds?:number, restSeconds:number}} defaults
 */

const STOP = [
  "Stop if you feel chest pain or pressure, faintness, unusual breathlessness, or sharp pain.",
];

/** @type {Record<string, ExerciseDefinition>} */
export const EXERCISES = Object.freeze({
  chair_squat: {
    id: "chair_squat", version: "1.0.0", title: "Chair squat", titleBn: "চেয়ার স্কোয়াট",
    category: "lower_body", intendedUse: "wellness", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Hips, thighs", difficulty: "beginner", cameraView: "side",
    equipment: ["Stable chair"],
    steps: ["Stand in front of a stable chair, feet hip-width apart.", "Bend your knees and lower slowly until you lightly touch the seat.", "Push through your heels to stand tall again."],
    stepsBn: ["স্থির চেয়ারের সামনে দাঁড়ান, পা কোমরের সমান ফাঁকা রাখুন।", "হাঁটু ভাঁজ করে ধীরে নামুন, আসন হালকা স্পর্শ করুন।", "গোড়ালিতে ভর দিয়ে আবার সোজা হয়ে দাঁড়ান।"],
    stopCues: [...STOP, "Stop if your knees or hips hurt."], screeningFlags: ["knee_injury", "balance"],
    alternatives: ["sit_to_stand"],
    limitation: "Knee angle from one camera is an estimate. Keep your whole side in view.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  squat: {
    id: "squat", version: "1.0.0", title: "Bodyweight squat", titleBn: "স্কোয়াট",
    category: "lower_body", intendedUse: "wellness", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Hips, thighs", difficulty: "intermediate", cameraView: "side",
    equipment: [],
    steps: ["Stand tall, feet a little wider than hips.", "Sit your hips back and down as far as is comfortable.", "Stand back up fully before the next repetition."],
    stepsBn: ["সোজা দাঁড়ান, পা কোমরের চেয়ে একটু চওড়া।", "স্বচ্ছন্দ যতটা, নিতম্ব পেছনে ও নিচে নামান।", "পরেরটির আগে পুরোপুরি উঠে দাঁড়ান।"],
    stopCues: [...STOP, "Stop if your knees or back hurt."], screeningFlags: ["knee_injury", "balance"],
    alternatives: ["chair_squat", "sit_to_stand"],
    limitation: "Shallow movements are not counted. Depth is a 2D estimate, not motion capture.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  sit_to_stand: {
    id: "sit_to_stand", version: "1.0.0", title: "Sit to stand", titleBn: "বসা থেকে দাঁড়ানো",
    category: "mobility", intendedUse: "wellness", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Legs, balance", difficulty: "beginner", cameraView: "side",
    equipment: ["Stable chair"],
    steps: ["Sit near the front of a stable chair.", "Lean forward slightly and stand up. Use your hands or support if needed.", "Sit back down slowly."],
    stepsBn: ["স্থির চেয়ারের সামনের দিকে বসুন।", "সামান্য সামনে ঝুঁকে উঠে দাঁড়ান। প্রয়োজনে হাত বা সহায়তা নিন।", "ধীরে আবার বসুন।"],
    stopCues: [...STOP, "Have someone nearby if you are unsteady."], screeningFlags: ["balance"],
    alternatives: ["chair_squat"],
    limitation: "Needs the whole body in view from the side.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  wall_pushup: {
    id: "wall_pushup", version: "1.0.0", title: "Wall push-up", titleBn: "দেয়ালে পুশ-আপ",
    category: "upper_body", intendedUse: "wellness", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Chest, arms", difficulty: "beginner", cameraView: "side",
    equipment: ["Wall"],
    steps: ["Stand an arm's length from a wall, hands on it at shoulder height.", "Bend your elbows to bring your chest toward the wall.", "Push back until your arms are nearly straight."],
    stepsBn: ["দেয়াল থেকে এক হাত দূরে দাঁড়ান, কাঁধের উচ্চতায় হাত রাখুন।", "কনুই ভাঁজ করে বুক দেয়ালের দিকে আনুন।", "হাত প্রায় সোজা না হওয়া পর্যন্ত পেছনে ঠেলুন।"],
    stopCues: [...STOP, "Stop if your shoulder or wrist hurts."], screeningFlags: ["shoulder_injury"],
    alternatives: ["arm_raise"],
    limitation: "Counts visible elbow bends from the side. It cannot measure load or effort.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  arm_raise: {
    id: "arm_raise", version: "1.0.0", title: "Arm raise", titleBn: "হাত তোলা",
    category: "upper_body", intendedUse: "wellness", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Shoulders", difficulty: "beginner", cameraView: "front",
    equipment: [],
    steps: ["Sit or stand tall with arms by your sides.", "Raise one or both arms forward or out to shoulder height.", "Lower slowly."],
    stepsBn: ["সোজা হয়ে বসুন বা দাঁড়ান, হাত পাশে রাখুন।", "এক বা দুই হাত কাঁধের উচ্চতা পর্যন্ত তুলুন।", "ধীরে নামান।"],
    stopCues: [...STOP, "Stop if your shoulder hurts."], screeningFlags: ["shoulder_injury"],
    alternatives: ["shoulder_mobility"],
    limitation: "Counts the arm the camera sees best.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 30 },
  },
  smile: {
    id: "smile", version: "1.0.0", title: "Gentle smile", titleBn: "আলতো হাসি",
    category: "face", intendedUse: "wellness", kind: "reps", trackingMethod: "face_blendshape",
    validationLevel: "demo", area: "Cheeks, lips", difficulty: "beginner", cameraView: "front",
    equipment: [],
    steps: ["Face the camera with a relaxed face.", "Smile gently and hold.", "Relax back to neutral."],
    stepsBn: ["আরামদায়ক মুখে ক্যামেরার দিকে তাকান।", "আলতো হাসুন এবং ধরে রাখুন।", "আবার স্বাভাবিক মুখে ফিরুন।"],
    stopCues: ["Stop if it is painful or you notice new facial weakness or numbness."], screeningFlags: ["facial_neuro"],
    alternatives: [],
    limitation: "Expression matching only. It does not measure muscle strength or change face shape.",
    defaults: { sets: 1, targetReps: 5, holdSeconds: 2, restSeconds: 20 },
  },
  eyebrow_raise: {
    id: "eyebrow_raise", version: "1.0.0", title: "Eyebrow raise", titleBn: "ভ্রু তোলা",
    category: "face", intendedUse: "wellness", kind: "reps", trackingMethod: "face_blendshape",
    validationLevel: "demo", area: "Forehead, eyebrows", difficulty: "beginner", cameraView: "front",
    equipment: [],
    steps: ["Face the camera with a relaxed face.", "Lift your eyebrows gently and hold.", "Relax."],
    stepsBn: ["আরামদায়ক মুখে ক্যামেরার দিকে তাকান।", "আলতো করে ভ্রু তুলে ধরে রাখুন।", "স্বাভাবিক হন।"],
    stopCues: ["Stop if it is painful or you notice new facial weakness or numbness."], screeningFlags: ["facial_neuro"],
    alternatives: [],
    limitation: "Expression matching only. Not a measure of muscle power.",
    defaults: { sets: 1, targetReps: 5, holdSeconds: 2, restSeconds: 20 },
  },
  cheek_puff: {
    id: "cheek_puff", version: "1.0.0", title: "Cheek puff", titleBn: "গাল ফোলানো",
    category: "face", intendedUse: "wellness", kind: "reps", trackingMethod: "face_blendshape",
    validationLevel: "demo", area: "Cheeks", difficulty: "beginner", cameraView: "front",
    equipment: [],
    steps: ["Close your lips gently.", "Puff your cheeks with comfortable air and hold.", "Breathe out and relax."],
    stepsBn: ["ঠোঁট আলতো করে বন্ধ করুন।", "স্বচ্ছন্দ বাতাসে গাল ফুলিয়ে ধরে রাখুন।", "শ্বাস ছেড়ে স্বাভাবিক হন।"],
    stopCues: ["Stop if it is painful or you feel dizzy."], screeningFlags: ["facial_neuro"],
    alternatives: ["smile"],
    limitation: "Experimental: the face model's cheek signal is weak for some faces. Use manual counting if it misses.",
    defaults: { sets: 1, targetReps: 3, holdSeconds: 2, restSeconds: 20 },
  },
  lip_purse: {
    id: "lip_purse", version: "1.0.0", title: "Relaxed lip purse", titleBn: "ঠোঁট গোল করা",
    category: "face", intendedUse: "wellness", kind: "reps", trackingMethod: "manual",
    validationLevel: "demo", area: "Lips", difficulty: "beginner", equipment: [],
    steps: ["Gently purse your lips as if to whistle.", "Hold briefly.", "Relax."],
    stepsBn: ["শিস দেওয়ার মতো আলতো করে ঠোঁট গোল করুন।", "একটু ধরে রাখুন।", "স্বাভাবিক হন।"],
    stopCues: ["Stop if it is painful."], screeningFlags: ["facial_neuro"], alternatives: ["smile"],
    limitation: "Manual counting.", defaults: { sets: 1, targetReps: 5, holdSeconds: 2, restSeconds: 20 },
  },
  jaw_open_close: {
    id: "jaw_open_close", version: "1.0.0", title: "Gentle jaw open and close", titleBn: "চোয়াল আলতো খোলা-বন্ধ",
    category: "face", intendedUse: "clinician_assigned", kind: "reps", trackingMethod: "manual",
    validationLevel: "demo", area: "Jaw", difficulty: "beginner", equipment: [], specialist: true,
    steps: ["Only as prescribed by your clinician.", "Open your mouth slowly within a pain-free range.", "Close gently."],
    stepsBn: ["শুধু চিকিৎসকের নির্দেশমতো।", "ব্যথাহীন সীমায় ধীরে মুখ খুলুন।", "আলতো করে বন্ধ করুন।"],
    stopCues: ["Stop if your jaw hurts, clicks painfully or locks."], screeningFlags: ["tmj"], alternatives: [],
    limitation: "Jaw programs need clinician approval. Manual counting only.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 30 },
  },
  shoulder_mobility: {
    id: "shoulder_mobility", version: "1.0.0", title: "Gentle shoulder rolls", titleBn: "আলতো কাঁধ ঘোরানো",
    category: "mobility", intendedUse: "wellness", kind: "reps", trackingMethod: "manual",
    validationLevel: "demo", area: "Shoulders", difficulty: "beginner", equipment: [],
    steps: ["Sit or stand tall.", "Roll your shoulders up, back and down slowly.", "Repeat in a comfortable range."],
    stepsBn: ["সোজা হয়ে বসুন বা দাঁড়ান।", "ধীরে কাঁধ উপরে, পেছনে ও নিচে ঘোরান।", "স্বচ্ছন্দ সীমায় আবার করুন।"],
    stopCues: [...STOP], screeningFlags: ["shoulder_injury"], alternatives: ["arm_raise"],
    limitation: "Manual counting.", defaults: { sets: 1, targetReps: 5, restSeconds: 30 },
  },
  heel_raise: {
    id: "heel_raise", version: "1.0.0", title: "Supported heel raise", titleBn: "সাপোর্ট নিয়ে গোড়ালি তোলা",
    category: "lower_body", intendedUse: "wellness", kind: "reps", trackingMethod: "manual",
    validationLevel: "demo", area: "Calves, balance", difficulty: "beginner", equipment: ["Chair or counter for support"],
    steps: ["Hold a chair back or counter.", "Rise onto your toes.", "Lower slowly."],
    stepsBn: ["চেয়ারের পিঠ বা টেবিল ধরুন।", "পায়ের আঙুলের ওপর উঠুন।", "ধীরে নামুন।"],
    stopCues: [...STOP], screeningFlags: ["balance"], alternatives: ["sit_to_stand"],
    limitation: "Manual counting.", defaults: { sets: 1, targetReps: 8, restSeconds: 30 },
  },
  lunge: {
    id: "lunge", version: "1.0.0", title: "Supported lunge", titleBn: "সাপোর্ট নিয়ে লাঞ্জ",
    category: "lower_body", intendedUse: "wellness", kind: "reps", trackingMethod: "manual",
    validationLevel: "demo", area: "Legs", difficulty: "intermediate", equipment: ["Support nearby"],
    steps: ["Step one foot forward.", "Lower your back knee a comfortable distance.", "Push back up and switch sides."],
    stepsBn: ["এক পা সামনে দিন।", "পেছনের হাঁটু স্বচ্ছন্দ দূরত্বে নামান।", "উঠে দিক বদলান।"],
    stopCues: [...STOP, "Stop if your knee hurts."], screeningFlags: ["knee_injury", "balance"], alternatives: ["chair_squat"],
    limitation: "Manual counting.", defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  incline_pushup: {
    id: "incline_pushup", version: "1.0.0", title: "Incline push-up", titleBn: "ইনক্লাইন পুশ-আপ",
    category: "upper_body", intendedUse: "wellness", kind: "reps", trackingMethod: "manual",
    validationLevel: "demo", area: "Chest, arms", difficulty: "intermediate", equipment: ["Sturdy table or bench"],
    steps: ["Hands on a sturdy table edge, body straight.", "Lower your chest toward the edge.", "Push back up."],
    stepsBn: ["মজবুত টেবিলের কিনারায় হাত রাখুন, শরীর সোজা।", "বুক কিনারার দিকে নামান।", "আবার ঠেলে উঠুন।"],
    stopCues: [...STOP], screeningFlags: ["shoulder_injury"], alternatives: ["wall_pushup"],
    limitation: "Manual counting.", defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  supported_plank: {
    id: "supported_plank", version: "1.0.0", title: "Supported plank hold", titleBn: "সাপোর্টেড প্ল্যাঙ্ক",
    category: "core", intendedUse: "wellness", kind: "timed_hold", trackingMethod: "manual",
    validationLevel: "demo", area: "Core", difficulty: "beginner", equipment: ["Table, wall or knees down"],
    steps: ["Hands on a table or wall, or knees on the floor.", "Keep a straight line from head to knees or heels.", "Breathe normally and hold."],
    stepsBn: ["টেবিল বা দেয়ালে হাত, অথবা হাঁটু মেঝেতে।", "মাথা থেকে হাঁটু/গোড়ালি সোজা রাখুন।", "স্বাভাবিক শ্বাস নিয়ে ধরে রাখুন।"],
    stopCues: [...STOP, "Do not hold your breath."], screeningFlags: ["back_injury"], alternatives: ["bridge"],
    limitation: "Hold time is counted by the timer you start. Core work does not target belly fat.",
    defaults: { sets: 2, holdSeconds: 15, restSeconds: 30 },
  },
  bridge: {
    id: "bridge", version: "1.0.0", title: "Glute bridge", titleBn: "গ্লুট ব্রিজ",
    category: "core", intendedUse: "wellness", kind: "reps", trackingMethod: "manual",
    validationLevel: "demo", area: "Hips, lower back", difficulty: "beginner", equipment: ["Mat"],
    steps: ["Lie on your back with knees bent.", "Lift your hips to a comfortable height.", "Lower slowly."],
    stepsBn: ["হাঁটু ভাঁজ করে চিত হয়ে শুয়ে পড়ুন।", "স্বচ্ছন্দ উচ্চতায় নিতম্ব তুলুন।", "ধীরে নামান।"],
    stopCues: [...STOP], screeningFlags: ["back_injury"], alternatives: ["supported_plank"],
    limitation: "Manual counting.", defaults: { sets: 1, targetReps: 8, restSeconds: 30 },
  },
  knee_extension: {
    id: "knee_extension", version: "1.0.0", title: "Seated knee extension", titleBn: "বসে হাঁটু সোজা করা",
    category: "rehab", intendedUse: "clinician_assigned", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Knee, thigh", difficulty: "beginner", cameraView: "side", equipment: ["Stable chair"],
    steps: ["Only as set by your clinician.", "Sit on a stable chair with the camera side-on at knee height.", "Straighten your knee within the range your clinician set, then lower slowly."],
    stepsBn: ["শুধু চিকিৎসকের নির্ধারিত মতো।", "স্থির চেয়ারে বসুন, পাশ থেকে হাঁটুর উচ্চতায় ক্যামেরা রাখুন।", "চিকিৎসকের দেওয়া সীমার মধ্যে হাঁটু সোজা করুন, তারপর ধীরে নামান।"],
    stopCues: [...STOP, "Stop if your knee pain increases."], screeningFlags: ["knee_injury"], alternatives: [],
    limitation: "Uses the angles your clinician set. A 2D camera estimate, not a clinical goniometer.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  elbow_flexion: {
    id: "elbow_flexion", version: "1.0.0", title: "Elbow bend", titleBn: "কনুই ভাঁজ করা",
    category: "rehab", intendedUse: "clinician_assigned", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Elbow, arm", difficulty: "beginner", cameraView: "side", equipment: [],
    steps: ["Only as set by your clinician.", "Keep your upper arm still, camera side-on to the working arm.", "Bend and straighten the elbow within the set range."],
    stepsBn: ["শুধু চিকিৎসকের নির্ধারিত মতো।", "বাহু স্থির রাখুন, যে হাত নাড়াবেন তার পাশে ক্যামেরা রাখুন।", "নির্ধারিত সীমায় কনুই ভাঁজ ও সোজা করুন।"],
    stopCues: [...STOP, "Stop if your elbow pain increases."], screeningFlags: ["shoulder_injury"], alternatives: [],
    limitation: "Uses the angles your clinician set. A 2D camera estimate.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  shoulder_flexion: {
    id: "shoulder_flexion", version: "1.0.0", title: "Forward arm raise", titleBn: "সামনে হাত তোলা",
    category: "rehab", intendedUse: "clinician_assigned", kind: "reps", trackingMethod: "pose_landmarks",
    validationLevel: "demo", area: "Shoulder", difficulty: "beginner", cameraView: "side", equipment: [],
    steps: ["Only as set by your clinician.", "Camera side-on; keep hip, shoulder and elbow visible.", "Raise the arm forward within the set range and lower slowly."],
    stepsBn: ["শুধু চিকিৎসকের নির্ধারিত মতো।", "পাশে ক্যামেরা রাখুন; নিতম্ব, কাঁধ ও কনুই দৃশ্যমান রাখুন।", "নির্ধারিত সীমায় হাত সামনে তুলুন, ধীরে নামান।"],
    stopCues: [...STOP, "Stop if your shoulder pain increases."], screeningFlags: ["shoulder_injury"], alternatives: [],
    limitation: "Uses the angles your clinician set. A 2D camera estimate.",
    defaults: { sets: 1, targetReps: 5, restSeconds: 45 },
  },
  walk_log: {
    id: "walk_log", version: "1.0.0", title: "Easy walk", titleBn: "সহজ হাঁটা",
    category: "full_body", intendedUse: "wellness", kind: "duration", trackingMethod: "manual",
    validationLevel: "demo", area: "Whole body", difficulty: "beginner", equipment: [],
    steps: ["Walk at a pace where you can still talk.", "Log the minutes when you finish."],
    stepsBn: ["এমন গতিতে হাঁটুন যাতে কথা বলা যায়।", "শেষে মিনিট লিখে রাখুন।"],
    stopCues: [...STOP], screeningFlags: [], alternatives: [],
    limitation: "Self-reported duration. No calories are estimated.",
    defaults: { sets: 1, durationSeconds: 600, restSeconds: 0 },
  },
});

export const CATEGORIES = Object.freeze([
  { id: "face", title: "Face movements", titleBn: "মুখের নড়াচড়া", blurb: "Gentle expression practice: smile, eyebrows, cheeks.", minutes: 5, difficulty: "Beginner", equipment: "None", safety: "Expression practice does not reshape the face or reduce facial fat." },
  { id: "upper_body", title: "Upper body and arms", titleBn: "শরীরের উপরের অংশ", blurb: "Wall and incline push-ups, arm raises, seated options.", minutes: 10, difficulty: "Beginner to intermediate", equipment: "Wall, table", safety: "The camera counts visible movement only; it cannot see weight or effort." },
  { id: "lower_body", title: "Lower body", titleBn: "শরীরের নিচের অংশ", blurb: "Chair squats, sit to stand, heel raises, lunges.", minutes: 10, difficulty: "Beginner to intermediate", equipment: "Chair", safety: "Keep support nearby if your balance is uncertain." },
  { id: "core", title: "Core and weight management", titleBn: "কোর ও ওজন ব্যবস্থাপনা", blurb: "Whole-body activity plus optional core strengthening.", minutes: 15, difficulty: "Beginner", equipment: "Mat, table", safety: "No exercise burns fat from one spot. Weight change comes from overall activity and food." },
  { id: "full_body", title: "Whole body fitness", titleBn: "পুরো শরীর", blurb: "Low-impact circuits that mix strength and walking.", minutes: 15, difficulty: "Beginner", equipment: "Chair, wall", safety: "Include rest days. Increase only when it feels easy, and only after you confirm." },
  { id: "mobility", title: "Mobility, balance and senior wellness", titleBn: "চলাচল ও ভারসাম্য", blurb: "Chair exercises, gentle range of motion, sit to stand.", minutes: 10, difficulty: "Beginner", equipment: "Chair", safety: "Have someone nearby if you might fall." },
  { id: "rehab", title: "Recovery plan", titleBn: "রিকভারি প্ল্যান", blurb: "Programs your clinician assigns. Not available without one.", minutes: null, difficulty: "Clinician set", equipment: "As prescribed", safety: "Medical rehabilitation needs a clinician. General plans are not prescriptions." },
  { id: "heart", title: "Heart-conscious movement", titleBn: "হৃদয়-সচেতন চলাচল", blurb: "Education and a record of your clinician-approved plan.", minutes: null, difficulty: "Clinician set", equipment: "None", safety: "Many people with heart conditions can exercise with a clinician's plan. Warning symptoms mean stop and get help." },
]);

/** Goals are discovery labels, not promised results. `clarify` is shown before continuing. */
export const GOALS = Object.freeze({
  face: [
    { id: "expression", label: "Practise facial expressions" },
    { id: "facial_fat", label: "Lose facial fat", clarify: "Facial exercises have not been shown to reduce facial fat. Overall weight change comes from whole-body activity and food. You can still practise expressions here." },
    { id: "jawline", label: "Sharpen my jawline", clarify: "Exercises cannot reliably change jaw shape. Jaw exercises are only safe as part of a clinician's plan, especially with jaw pain or clicking. We can offer gentle expression practice instead." },
  ],
  upper_body: [
    { id: "stronger_arms", label: "Stronger arms" },
    { id: "posture_shoulders", label: "Easier shoulder movement" },
  ],
  lower_body: [
    { id: "squat_technique", label: "Better squat technique" },
    { id: "leg_strength", label: "Stronger legs for daily life" },
  ],
  core: [
    { id: "core_strength", label: "Stronger core" },
    { id: "weight_activity", label: "Manage weight with sustainable activity" },
    { id: "belly_fat", label: "Burn belly fat", clarify: "No exercise burns fat from one area. A mix of regular activity, strength work and food habits supports overall weight change. We'll suggest a whole-body plan with optional core work." },
  ],
  full_body: [
    { id: "endurance", label: "Improve endurance" },
    { id: "general_strength", label: "General strength" },
    { id: "lose_fast", label: "Lose weight fast", clarify: "Rapid weight loss plans can be unsafe. We'll start with a gentle, steady routine instead." },
  ],
  mobility: [
    { id: "maintain_mobility", label: "Maintain mobility" },
    { id: "balance", label: "Better balance" },
  ],
  rehab: [{ id: "assigned", label: "Follow my clinician's plan" }],
  heart: [{ id: "heart_plan", label: "Follow my clinician-approved activity plan" }],
});

/**
 * @typedef {{exerciseId:string, sets:number, targetReps?:number, holdSeconds?:number, durationSeconds?:number, restSeconds:number, optional?:boolean, clinicianLocked?:boolean, limits?:{start:number, target:number, return:number}, holdMs?:number, side?:"left"|"right"}} ExerciseStep
 * @typedef {{id:string, name:string, category:string, userGoal:string, locale:"en"|"bn", warmUpSeconds:number, coolDownSeconds:number, sequence:ExerciseStep[], authoredBy:"content_team"|"user"|"clinician", clinicianName?:string, clinicianId?:string, approvedAt?:string, version:string, why?:string, notes?:string, professionalIdentityVerified?:boolean}} WorkoutProgram
 */

const step = (exerciseId, overrides = {}) => ({ exerciseId, ...EXERCISES[exerciseId].defaults, ...overrides });

/** Configurable examples, not prescriptions. */
export const TEMPLATES = Object.freeze({
  face: { name: "Gentle face practice", sequence: [step("smile"), step("eyebrow_raise"), step("cheek_puff", { optional: true })] },
  upper_body: { name: "Upper body starter", sequence: [step("wall_pushup"), step("arm_raise"), step("shoulder_mobility")] },
  lower_body: { name: "Lower body starter", sequence: [step("chair_squat"), step("sit_to_stand"), step("heel_raise")] },
  core: { name: "Whole body with core", sequence: [step("walk_log", { durationSeconds: 300 }), step("chair_squat"), step("supported_plank"), step("bridge", { optional: true })] },
  full_body: { name: "Low-impact circuit", sequence: [step("wall_pushup"), step("sit_to_stand"), step("shoulder_mobility")] },
  mobility: { name: "Chair mobility", sequence: [step("sit_to_stand"), step("shoulder_mobility"), step("arm_raise")] },
});

const SEATED_SAFE = new Set(["arm_raise", "shoulder_mobility", "smile", "eyebrow_raise", "cheek_puff", "lip_purse"]);

/**
 * Build a recommended starter plan from wizard answers. Returns null for categories that
 * require a clinician (rehab, heart without a plan) so the UI can explain instead.
 */
export function recommendProgram(answers) {
  const category = answers?.category;
  const template = TEMPLATES[category];
  if (!template) return null;
  let sequence = template.sequence.map((s) => ({ ...s }));
  if (answers.seatedOnly)
    sequence = sequence.map((s) => (SEATED_SAFE.has(s.exerciseId) || EXERCISES[s.exerciseId].category === "face" ? s : { ...s, exerciseId: "arm_raise", ...EXERCISES.arm_raise.defaults }));
  if (answers.level === "inactive" || answers.level === "beginner")
    sequence = sequence.map((s) => ({ ...s, sets: 1, targetReps: s.targetReps ? Math.min(s.targetReps, 5) : s.targetReps, restSeconds: Math.max(s.restSeconds, 45) }));
  if (answers.level === "inactive")
    sequence = sequence.map((s) => (EXERCISES[s.exerciseId].difficulty === "beginner" ? s : { ...s, exerciseId: EXERCISES[s.exerciseId].alternatives[0] ?? s.exerciseId }));
  // Drop exercises whose equipment the person said they don't have.
  if (answers.noChair) sequence = sequence.filter((s) => !EXERCISES[s.exerciseId].equipment.some((e) => /chair/i.test(e)) || SEATED_SAFE.has(s.exerciseId));
  const unique = [];
  for (const s of sequence) if (!unique.some((u) => u.exerciseId === s.exerciseId)) unique.push(s);
  const minutes = Number(answers.minutes) || 10;
  return {
    id: `starter-${category}-${Date.now().toString(36)}`,
    name: template.name,
    category,
    userGoal: answers.goal ?? "",
    locale: answers.language === "bn" ? "bn" : "en",
    warmUpSeconds: 30,
    coolDownSeconds: 30,
    sequence: unique.slice(0, minutes <= 5 ? 2 : 4),
    authoredBy: "content_team",
    version: CATALOG_VERSION,
    why: whyText(answers),
  };
}

function whyText(answers) {
  const parts = [];
  parts.push(answers.level === "inactive" ? "You're starting from inactive, so every exercise is a beginner version with longer rests." : "Matched to the level you chose.");
  if (answers.seatedOnly) parts.push("Standing exercises were swapped for seated ones.");
  if (answers.noChair) parts.push("Chair exercises were left out because you don't have one.");
  parts.push("It's an example to start from, not a prescription. You can change sets, reps and rest.");
  return parts.join(" ");
}

/** Validate a program before a session uses it. */
export function validateProgram(program) {
  if (!program || !Array.isArray(program.sequence) || !program.sequence.length) throw new Error("This plan has no exercises.");
  if (program.sequence.length > 20) throw new Error("A session can have at most 20 exercises.");
  for (const s of program.sequence) {
    if (!EXERCISES[s.exerciseId]) throw new Error(`Unknown exercise: ${s.exerciseId}`);
    if (!Number.isInteger(s.sets) || s.sets < 1 || s.sets > 10) throw new Error("Sets must be 1 to 10.");
    if (s.targetReps !== undefined && (!Number.isInteger(s.targetReps) || s.targetReps < 1 || s.targetReps > 50)) throw new Error("Reps must be 1 to 50.");
    if (s.holdSeconds !== undefined && (!Number.isFinite(s.holdSeconds) || s.holdSeconds < 1 || s.holdSeconds > 120)) throw new Error("Holds must be 1 to 120 seconds.");
    if (!Number.isFinite(s.restSeconds) || s.restSeconds < 0 || s.restSeconds > 300) throw new Error("Rest must be 0 to 300 seconds.");
    if (EXERCISES[s.exerciseId].intendedUse === "clinician_assigned" && program.authoredBy !== "clinician") throw new Error(`${EXERCISES[s.exerciseId].title} needs a clinician-assigned plan.`);
    if (s.limits !== undefined) {
      if (program.authoredBy !== "clinician") throw new Error("Only a clinician plan can set movement angles.");
      if (![s.limits.start, s.limits.target, s.limits.return].every(angle)) throw new Error("Movement angles must be between 0 and 180 degrees.");
    }
  }
  return program;
}

const CLINIC_IDS = { "knee-extension": "knee_extension", "elbow-flexion": "elbow_flexion", "shoulder-flexion": "shoulder_flexion", "sit-to-stand": "sit_to_stand" };
const angle = (v) => Number.isFinite(v) && v >= 0 && v <= 180;

/**
 * Accept a clinician plan only with explicit clinician origin, a named clinician and an approval date.
 * Takes the Clinic workspace's plan record, its exported form, or a multi-exercise program.
 */
export function importClinicianProgram(json) {
  const value = json?.plan?.value ?? json?.plan ?? json?.value ?? json;
  const origin = json?.plan?.source ?? json?.source ?? value?.source;
  const approvedAt = value?.approvedAt ?? value?.at;
  if (origin !== "clinician" || typeof value?.clinicianName !== "string" || !value.clinicianName.trim() || !Number.isFinite(Date.parse(approvedAt)))
    throw new Error("This file is not a clinician-approved plan (it needs the clinician's name, approval date and clinician origin).");
  const items = Array.isArray(value.exercises) ? value.exercises : value.exerciseId ? [value] : [];
  const sequence = items
    .map((item) => {
      const id = EXERCISES[item.exerciseId] ? item.exerciseId : CLINIC_IDS[item.exerciseId];
      if (!id) return null;
      const reps = [item.repsPerSet, item.targetReps, item.reps].find(Number.isInteger);
      const start = item.limits?.start ?? item.startAngle, target = item.limits?.target ?? item.targetAngle;
      const ret = item.limits?.return ?? item.returnAngle ?? start;
      const limits = [start, target, ret].every((v) => v !== undefined) ? { start: Number(start), target: Number(target), return: Number(ret) } : undefined;
      return {
        exerciseId: id,
        sets: Number.isInteger(item.sets) ? item.sets : 1,
        targetReps: reps ?? EXERCISES[id].defaults.targetReps,
        holdSeconds: Number.isFinite(item.holdSeconds) ? item.holdSeconds : EXERCISES[id].defaults.holdSeconds,
        restSeconds: Number.isFinite(item.restSeconds) ? item.restSeconds : EXERCISES[id].defaults.restSeconds,
        ...(limits ? { limits } : {}),
        ...(Number.isFinite(item.holdMs) ? { holdMs: item.holdMs } : {}),
        ...(item.side === "left" || item.side === "right" ? { side: item.side } : {}),
        clinicianLocked: true,
      };
    })
    .filter(Boolean);
  if (!sequence.length) throw new Error("The plan has no exercises ASHA Move can show.");
  return validateProgram({
    id: String(json?.plan?.id ?? json?.id ?? value.id ?? `clinician-${Date.now().toString(36)}`),
    name: String(value.title ?? value.name ?? `Plan from ${value.clinicianName.trim()}`),
    category: "rehab",
    userGoal: "assigned",
    locale: "en",
    warmUpSeconds: 30,
    coolDownSeconds: 30,
    sequence,
    authoredBy: "clinician",
    clinicianName: value.clinicianName.trim(),
    clinicianId: typeof value.clinicianId === "string" ? value.clinicianId : undefined,
    approvedAt: new Date(Date.parse(approvedAt)).toISOString(),
    professionalIdentityVerified: false,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 500) : "",
    version: String(value.version ?? "1"),
  });
}

export const title = (exercise, language) => (language === "bn" ? exercise.titleBn : exercise.title);
export const steps = (exercise, language) => (language === "bn" ? exercise.stepsBn : exercise.steps);
