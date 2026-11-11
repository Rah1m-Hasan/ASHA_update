// ASHA Move lessons: what a person sees and hears before and while doing each exercise.
// Captions follow the demonstration in demo.js segment by segment (the `cap` index), in English and
// Bangla, so the words always match the movement on screen. Plain language, no promised results.

export const LESSON_VERSION = "move-lessons/1.0.0";

const T = (en, bn) => ({ en, bn });

/** Where the camera should be. Shown as an icon and a sentence in Learn and Set up. */
export const VIEWPOINTS = Object.freeze({
  front: T("Camera in front of you, at chest height, 1.5–2 metres away.", "ক্যামেরা আপনার সামনে, বুকের উচ্চতায়, ১.৫–২ মিটার দূরে।"),
  side: T("Camera to your side, about hip height, 2–3 metres away, whole body in view.", "ক্যামেরা আপনার পাশে, কোমরের উচ্চতায়, ২–৩ মিটার দূরে, পুরো শরীর দেখা যাবে।"),
  seated: T("Sit side-on to the camera, about 1.5–2 metres away, with your legs in view.", "ক্যামেরার দিকে পাশ ফিরে বসুন, ১.৫–২ মিটার দূরে, পা দেখা যাবে।"),
  floor: T("Camera low and to your side, about 2 metres away.", "ক্যামেরা নিচু করে পাশে রাখুন, প্রায় ২ মিটার দূরে।"),
  face: T("Face the camera from about an arm's length, in good light.", "ভালো আলোয়, প্রায় এক হাত দূর থেকে ক্যামেরার দিকে তাকান।"),
  hand: T("Hold your hand up facing the camera, about 40–60 cm away.", "হাত ক্যামেরার দিকে তুলে ধরুন, প্রায় ৪০–৬০ সেমি দূরে।"),
});

/** What has to be inside the picture: drives the framing guide drawn over the camera. */
export const FRAMING = Object.freeze({ front: "upper_body", side: "full_body", seated: "full_body", floor: "full_body", face: "face", hand: "hand" });

const STOP_UNWELL = T("Stop at once if you feel chest pain or pressure, faintness, unusual breathlessness or sharp pain.", "বুকে ব্যথা বা চাপ, মাথা ঘোরা, অস্বাভাবিক শ্বাসকষ্ট বা তীব্র ব্যথা হলে সঙ্গে সঙ্গে থামুন।");
const FACE_STOP = T("Stop if it hurts or you notice new weakness or numbness in your face.", "ব্যথা হলে বা মুখে নতুন দুর্বলতা বা অবশভাব টের পেলে থামুন।");

/**
 * @typedef {{en:string, bn:string}} Text
 * @typedef {{goal:Text, viewpoint:keyof typeof VIEWPOINTS, space:Text, easier:Text, cautions:Text[], captions:{en:string[], bn:string[]}, keyTip:Text, topErrors:Text[], practice:number}} Lesson
 */

/** @type {Record<string, Lesson>} */
export const LESSONS = Object.freeze({
  arm_raise: {
    goal: T("Keep your shoulders moving comfortably through daily reaches.", "দৈনন্দিন কাজে কাঁধ স্বচ্ছন্দে নাড়াতে সাহায্য করে।"),
    viewpoint: "front", space: T("Room to lift your arms out to the side. No equipment.", "দুই পাশে হাত তোলার জায়গা। কোনো সরঞ্জাম লাগবে না।"),
    easier: T("Sit on a chair and raise one arm at a time, only as high as is comfortable.", "চেয়ারে বসে একবারে এক হাত, যতটা আরাম লাগে ততটাই তুলুন।"),
    cautions: [STOP_UNWELL, T("Stop if your shoulder hurts. Don't force the last few centimetres.", "কাঁধে ব্যথা হলে থামুন। শেষটুকু জোর করে তুলবেন না।")],
    captions: {
      en: ["Stand or sit tall with your arms by your sides.", "Raise your arms slowly out to shoulder height.", "Pause for a moment.", "Lower your arms slowly."],
      bn: ["হাত দুই পাশে রেখে সোজা হয়ে দাঁড়ান বা বসুন।", "ধীরে ধীরে কাঁধের উচ্চতা পর্যন্ত হাত তুলুন।", "এক মুহূর্ত থামুন।", "ধীরে ধীরে হাত নামান।"],
    },
    keyTip: T("Lift slowly and lower even more slowly.", "ধীরে তুলুন, আরও ধীরে নামান।"),
    topErrors: [T("Shrugging your shoulders up toward your ears", "কাঁধ কানের দিকে উঁচু করে ফেলা"), T("Swinging your arms instead of lifting", "তোলার বদলে হাত দোলানো")],
    practice: 2,
  },
  squat: {
    goal: T("Build leg strength for getting up, climbing stairs and lifting.", "ওঠা, সিঁড়ি চড়া ও কিছু তোলার জন্য পায়ের শক্তি বাড়ায়।"),
    viewpoint: "side", space: T("A clear space about 1 metre wide. Something stable nearby to hold if needed.", "প্রায় ১ মিটার খালি জায়গা। প্রয়োজনে ধরার জন্য কাছে স্থির কিছু।"),
    easier: T("Do a chair squat: lower until you lightly touch a chair seat.", "চেয়ার স্কোয়াট করুন: চেয়ারের আসন হালকা ছোঁয়া পর্যন্ত নামুন।"),
    cautions: [STOP_UNWELL, T("Stop if your knees or back hurt. Go only as low as is comfortable.", "হাঁটু বা পিঠে ব্যথা হলে থামুন। যতটা আরাম ততটাই নামুন।")],
    captions: {
      en: ["Stand tall, feet a little wider than your hips.", "Sit your hips back and down, arms forward for balance.", "Push through your heels and stand all the way up."],
      bn: ["সোজা দাঁড়ান, পা কোমরের চেয়ে একটু চওড়া।", "নিতম্ব পেছনে ও নিচে নামান, ভারসাম্যের জন্য হাত সামনে।", "গোড়ালিতে ভর দিয়ে পুরোপুরি উঠে দাঁড়ান।"],
    },
    keyTip: T("Stand all the way up between repetitions.", "প্রতিবারের মাঝে পুরোপুরি উঠে দাঁড়ান।"),
    topErrors: [T("Not standing fully between repetitions", "প্রতিবার পুরো উঠে না দাঁড়ানো"), T("Knees falling inward", "হাঁটু ভেতরের দিকে চলে যাওয়া")],
    practice: 1,
  },
  chair_squat: {
    goal: T("Practise the sit-down and stand-up movement safely with a chair behind you.", "পেছনে চেয়ার রেখে নিরাপদে বসা-ওঠার নড়াচড়া অনুশীলন।"),
    viewpoint: "side", space: T("A stable chair without wheels, against a wall if possible.", "চাকা ছাড়া স্থির চেয়ার, সম্ভব হলে দেয়ালের সাথে লাগানো।"),
    easier: T("Sit all the way down between repetitions, or use your hands on your thighs.", "প্রতিবার পুরো বসে পড়ুন, বা উরুতে হাত রেখে সাহায্য নিন।"),
    cautions: [STOP_UNWELL, T("Stop if your knees or hips hurt.", "হাঁটু বা নিতম্বে ব্যথা হলে থামুন।")],
    captions: {
      en: ["Stand in front of the chair, feet hip-width apart.", "Lower slowly until you lightly touch the seat.", "Push through your heels to stand tall again."],
      bn: ["চেয়ারের সামনে দাঁড়ান, পা কোমরের সমান ফাঁকা।", "আসন হালকা ছোঁয়া পর্যন্ত ধীরে নামুন।", "গোড়ালিতে ভর দিয়ে আবার সোজা হয়ে দাঁড়ান।"],
    },
    keyTip: T("Touch the seat lightly, don't drop onto it.", "আসন হালকা ছুঁয়ে দিন, ধপ করে বসবেন না।"),
    topErrors: [T("Dropping onto the seat", "আসনে ধপ করে বসে পড়া"), T("Leaning far forward to stand", "উঠতে অনেক বেশি সামনে ঝোঁকা")],
    practice: 1,
  },
  sit_to_stand: {
    goal: T("Make standing up from a chair easier and steadier.", "চেয়ার থেকে উঠে দাঁড়ানো সহজ ও স্থির করে।"),
    viewpoint: "side", space: T("A stable chair. Have someone nearby if your balance is uncertain.", "স্থির চেয়ার। ভারসাম্য নিয়ে সন্দেহ থাকলে কাছে কাউকে রাখুন।"),
    easier: T("Use your hands on the armrests or your thighs to help you up.", "উঠতে হাতলে বা উরুতে হাত রেখে সাহায্য নিন।"),
    cautions: [STOP_UNWELL, T("If you feel dizzy when you stand, sit down and rest.", "দাঁড়ালে মাথা ঘুরলে বসে বিশ্রাম নিন।")],
    captions: {
      en: ["Sit near the front of the chair, feet flat.", "Lean forward a little and stand up.", "Stand tall for a moment.", "Sit back down slowly."],
      bn: ["চেয়ারের সামনের দিকে বসুন, পা মাটিতে সমান।", "একটু সামনে ঝুঁকে উঠে দাঁড়ান।", "এক মুহূর্ত সোজা দাঁড়িয়ে থাকুন।", "ধীরে আবার বসুন।"],
    },
    keyTip: T("Lean forward first, then stand.", "আগে একটু সামনে ঝুঁকুন, তারপর দাঁড়ান।"),
    topErrors: [T("Standing up only part of the way", "পুরোপুরি না দাঁড়ানো"), T("Sitting down too fast", "খুব দ্রুত বসে পড়া")],
    practice: 1,
  },
  wall_pushup: {
    goal: T("Strengthen your chest and arms with your body weight against a wall.", "দেয়ালে ভর দিয়ে বুক ও হাতের শক্তি বাড়ায়।"),
    viewpoint: "side", space: T("A clear wall and non-slip floor.", "খালি দেয়াল ও পিছলে না যাওয়া মেঝে।"),
    easier: T("Stand closer to the wall so you lean less.", "দেয়ালের আরও কাছে দাঁড়ান যাতে কম ঝুঁকতে হয়।"),
    cautions: [STOP_UNWELL, T("Stop if your shoulder or wrist hurts.", "কাঁধ বা কব্জিতে ব্যথা হলে থামুন।")],
    captions: {
      en: ["Hands on the wall at shoulder height, body straight.", "Bend your elbows to bring your chest toward the wall.", "Push back steadily until your arms are nearly straight."],
      bn: ["কাঁধের উচ্চতায় দেয়ালে হাত, শরীর সোজা।", "কনুই ভাঁজ করে বুক দেয়ালের দিকে আনুন।", "হাত প্রায় সোজা না হওয়া পর্যন্ত ধীরে পেছনে ঠেলুন।"],
    },
    keyTip: T("Keep your body in one straight line.", "শরীর একটি সোজা রেখায় রাখুন।"),
    topErrors: [T("Hips sagging toward the wall", "নিতম্ব দেয়ালের দিকে ঝুলে পড়া"), T("Only bending a little", "খুব কম ভাঁজ করা")],
    practice: 1,
  },
  incline_pushup: {
    goal: T("A step up from wall push-ups using a sturdy table or bench.", "মজবুত টেবিল বা বেঞ্চ দিয়ে দেয়াল পুশ-আপের পরের ধাপ।"),
    viewpoint: "side", space: T("A sturdy table or bench that won't slide.", "পিছলে যাবে না এমন মজবুত টেবিল বা বেঞ্চ।"),
    easier: T("Go back to wall push-ups.", "আবার দেয়াল পুশ-আপ করুন।"),
    cautions: [STOP_UNWELL, T("Check the table is stable before you lean on it.", "ভর দেওয়ার আগে টেবিল স্থির কিনা দেখে নিন।")],
    captions: {
      en: ["Hands on the table edge, body straight.", "Lower your chest toward the edge.", "Push back up."],
      bn: ["টেবিলের কিনারায় হাত, শরীর সোজা।", "বুক কিনারার দিকে নামান।", "আবার ঠেলে উঠুন।"],
    },
    keyTip: T("Move slowly in both directions.", "দুই দিকেই ধীরে নড়ুন।"),
    topErrors: [T("Hips sagging", "নিতম্ব ঝুলে পড়া")],
    practice: 1,
  },
  supported_plank: {
    goal: T("Hold a steady straight body line to build core strength.", "শরীর সোজা রেখায় ধরে রেখে কোরের শক্তি বাড়ায়।"),
    viewpoint: "side", space: T("A sturdy table or wall, or a mat for a knees-down plank.", "মজবুত টেবিল বা দেয়াল, অথবা হাঁটু মেঝেতে রাখার জন্য ম্যাট।"),
    easier: T("Use a wall instead of a table, or hold for a shorter time.", "টেবিলের বদলে দেয়াল ব্যবহার করুন, বা কম সময় ধরে রাখুন।"),
    cautions: [STOP_UNWELL, T("Breathe normally. Don't hold your breath.", "স্বাভাবিকভাবে শ্বাস নিন। দম আটকে রাখবেন না।"), T("Core work does not burn belly fat from one spot.", "কোরের ব্যায়াম পেটের চর্বি আলাদাভাবে কমায় না।")],
    captions: {
      en: ["Hands on the table, step your feet back.", "Make a straight line from your head to your heels.", "Breathe normally and hold steady.", "Step your feet in to finish."],
      bn: ["টেবিলে হাত রেখে পা পেছনে নিন।", "মাথা থেকে গোড়ালি পর্যন্ত সোজা রেখা করুন।", "স্বাভাবিক শ্বাস নিয়ে স্থির থাকুন।", "শেষ করতে পা কাছে আনুন।"],
    },
    keyTip: T("Keep breathing while you hold.", "ধরে রাখার সময় শ্বাস নিতে থাকুন।"),
    topErrors: [T("Hips sagging or pushed up high", "নিতম্ব ঝুলে পড়া বা অনেক উঁচু হওয়া"), T("Holding your breath", "দম আটকে রাখা")],
    practice: 1,
  },
  heel_raise: {
    goal: T("Strengthen your calves and practise balance while holding support.", "সাপোর্ট ধরে পায়ের গোছের শক্তি ও ভারসাম্য অনুশীলন।"),
    viewpoint: "side", space: T("A chair back or counter to hold.", "ধরার জন্য চেয়ারের পিঠ বা টেবিল।"),
    easier: T("Do it sitting down: lift your heels while your toes stay on the floor.", "বসে করুন: আঙুল মাটিতে রেখে গোড়ালি তুলুন।"),
    cautions: [STOP_UNWELL, T("Hold on the whole time if your balance is uncertain.", "ভারসাম্য নিয়ে সন্দেহ থাকলে পুরো সময় ধরে রাখুন।")],
    captions: {
      en: ["Hold the chair back, feet flat.", "Rise slowly onto your toes.", "Lower your heels slowly."],
      bn: ["চেয়ারের পিঠ ধরুন, পা মাটিতে সমান।", "ধীরে পায়ের আঙুলের ওপর উঠুন।", "ধীরে গোড়ালি নামান।"],
    },
    keyTip: T("Keep your heels and feet in the camera's view.", "গোড়ালি ও পা ক্যামেরায় দেখা যায় এমনভাবে রাখুন।"),
    topErrors: [T("Bouncing instead of rising slowly", "ধীরে না উঠে লাফানো")],
    practice: 1,
  },
  lunge: {
    goal: T("Build leg strength and balance one side at a time.", "একবারে এক পাশে পায়ের শক্তি ও ভারসাম্য বাড়ায়।"),
    viewpoint: "side", space: T("About 2 metres of clear floor and support nearby.", "প্রায় ২ মিটার খালি মেঝে ও কাছে সাপোর্ট।"),
    easier: T("Take a shorter step and lower only a little, holding a chair.", "ছোট পা ফেলুন ও চেয়ার ধরে অল্প নামুন।"),
    cautions: [STOP_UNWELL, T("Stop if your knee hurts.", "হাঁটুতে ব্যথা হলে থামুন।")],
    captions: {
      en: ["Stand tall and step one foot forward.", "Lower your back knee a comfortable distance.", "Push back up and switch sides."],
      bn: ["সোজা দাঁড়িয়ে এক পা সামনে দিন।", "পেছনের হাঁটু স্বচ্ছন্দ দূরত্বে নামান।", "উঠে দাঁড়িয়ে দিক বদলান।"],
    },
    keyTip: T("Hold support if you feel unsteady.", "অস্থির লাগলে সাপোর্ট ধরুন।"),
    topErrors: [T("Front knee moving far past the toes", "সামনের হাঁটু আঙুল ছাড়িয়ে অনেক দূরে যাওয়া")],
    practice: 1,
  },
  bridge: {
    goal: T("Strengthen your hips and lower back while lying down.", "শুয়ে নিতম্ব ও কোমরের শক্তি বাড়ায়।"),
    viewpoint: "floor", space: T("A mat on the floor.", "মেঝেতে একটি ম্যাট।"),
    easier: T("Lift your hips only a little and lower straight away.", "নিতম্ব অল্প তুলে সঙ্গে সঙ্গে নামান।"),
    cautions: [STOP_UNWELL, T("Stop if your back hurts.", "পিঠে ব্যথা হলে থামুন।")],
    captions: {
      en: ["Lie on your back, knees bent, feet flat.", "Lift your hips to a comfortable height.", "Lower slowly."],
      bn: ["চিত হয়ে শুয়ে হাঁটু ভাঁজ করুন, পা মাটিতে।", "স্বচ্ছন্দ উচ্চতায় নিতম্ব তুলুন।", "ধীরে নামান।"],
    },
    keyTip: T("Lift with your hips, not your neck.", "ঘাড় নয়, নিতম্ব দিয়ে তুলুন।"),
    topErrors: [T("Arching the lower back", "কোমর বেশি বাঁকানো")],
    practice: 1,
  },
  knee_extension: {
    goal: T("Practise straightening your knee within the range your clinician set.", "চিকিৎসকের দেওয়া সীমার মধ্যে হাঁটু সোজা করার অনুশীলন।"),
    viewpoint: "seated", space: T("A stable chair.", "স্থির চেয়ার।"),
    easier: T("Ask your clinician before changing this exercise.", "এই ব্যায়াম বদলানোর আগে চিকিৎসকের সাথে কথা বলুন।"),
    cautions: [STOP_UNWELL, T("Stay within the range your clinician set. Stop if your knee pain increases.", "চিকিৎসকের সীমার মধ্যে থাকুন। হাঁটুর ব্যথা বাড়লে থামুন।")],
    captions: {
      en: ["Sit tall with your foot on the floor.", "Straighten your knee within your set range.", "Lower your foot slowly."],
      bn: ["সোজা হয়ে বসুন, পা মাটিতে।", "নির্ধারিত সীমার মধ্যে হাঁটু সোজা করুন।", "ধীরে পা নামান।"],
    },
    keyTip: T("Stay inside the range your clinician set.", "চিকিৎসকের দেওয়া সীমার ভেতরে থাকুন।"),
    topErrors: [T("Leaning back to lift the leg higher", "পা উঁচু করতে পেছনে হেলে পড়া")],
    practice: 1,
  },
  elbow_flexion: {
    goal: T("Practise bending and straightening your elbow within your set range.", "নির্ধারিত সীমায় কনুই ভাঁজ ও সোজা করার অনুশীলন।"),
    viewpoint: "side", space: T("Room to move your arm. No equipment unless your clinician added it.", "হাত নাড়ার জায়গা। চিকিৎসক না বললে কোনো সরঞ্জাম নয়।"),
    easier: T("Ask your clinician before changing this exercise.", "এই ব্যায়াম বদলানোর আগে চিকিৎসকের সাথে কথা বলুন।"),
    cautions: [STOP_UNWELL, T("Stop if your elbow pain increases.", "কনুইয়ের ব্যথা বাড়লে থামুন।")],
    captions: {
      en: ["Arm by your side, upper arm still.", "Bend your elbow within your set range.", "Straighten your arm slowly."],
      bn: ["হাত পাশে রাখুন, উপরের বাহু স্থির।", "নির্ধারিত সীমায় কনুই ভাঁজ করুন।", "ধীরে হাত সোজা করুন।"],
    },
    keyTip: T("Keep your upper arm still.", "উপরের বাহু স্থির রাখুন।"),
    topErrors: [T("Swinging the shoulder", "কাঁধ দোলানো")],
    practice: 1,
  },
  shoulder_flexion: {
    goal: T("Practise raising your arm forward within the range your clinician set.", "চিকিৎসকের সীমার মধ্যে হাত সামনে তোলার অনুশীলন।"),
    viewpoint: "side", space: T("Room to raise your arm in front of you.", "সামনে হাত তোলার জায়গা।"),
    easier: T("Ask your clinician before changing this exercise.", "এই ব্যায়াম বদলানোর আগে চিকিৎসকের সাথে কথা বলুন।"),
    cautions: [STOP_UNWELL, T("Stop if your shoulder pain increases.", "কাঁধের ব্যথা বাড়লে থামুন।")],
    captions: {
      en: ["Stand or sit tall, arm by your side.", "Raise your arm forward within your set range.", "Lower it slowly."],
      bn: ["সোজা দাঁড়ান বা বসুন, হাত পাশে।", "নির্ধারিত সীমায় হাত সামনে তুলুন।", "ধীরে নামান।"],
    },
    keyTip: T("Keep your hip, shoulder and elbow in view.", "নিতম্ব, কাঁধ ও কনুই দেখা যায় এমনভাবে থাকুন।"),
    topErrors: [T("Leaning back to lift higher", "উঁচু তুলতে পেছনে হেলে পড়া")],
    practice: 1,
  },
  walk_log: {
    goal: T("Easy walking you log yourself, at a pace where you can still talk.", "কথা বলা যায় এমন গতিতে সহজ হাঁটা, নিজে সময় লিখে রাখুন।"),
    viewpoint: "side", space: T("Somewhere safe to walk, indoors or out. Marching in place works too.", "হাঁটার নিরাপদ জায়গা, ভেতরে বা বাইরে। জায়গায় দাঁড়িয়ে মার্চ করলেও হবে।"),
    easier: T("Walk for a shorter time, or march gently while seated.", "কম সময় হাঁটুন, বা বসে আলতো মার্চ করুন।"),
    cautions: [STOP_UNWELL],
    captions: {
      en: ["Stand tall and relax your shoulders.", "Lift one knee, then the other, at an easy pace.", "Keep going at a pace where you can still talk."],
      bn: ["সোজা দাঁড়ান, কাঁধ শিথিল রাখুন।", "সহজ গতিতে এক হাঁটু, তারপর অন্যটি তুলুন।", "কথা বলা যায় এমন গতিতে চালিয়ে যান।"],
    },
    keyTip: T("You should still be able to talk.", "হাঁটার সময় কথা বলতে পারা উচিত।"),
    topErrors: [T("Going too fast to talk", "কথা বলা যায় না এত দ্রুত চলা")],
    practice: 0,
  },
  shoulder_mobility: {
    goal: T("Loosen stiff shoulders with slow, gentle rolls.", "ধীর, আলতো ঘোরানোয় শক্ত কাঁধ শিথিল করে।"),
    viewpoint: "front", space: T("Sit or stand. No equipment.", "বসে বা দাঁড়িয়ে। কোনো সরঞ্জাম লাগবে না।"),
    easier: T("Make the circles smaller.", "বৃত্ত ছোট করুন।"),
    cautions: [STOP_UNWELL, T("Stop if your shoulder hurts.", "কাঁধে ব্যথা হলে থামুন।")],
    captions: {
      en: ["Sit or stand tall, arms relaxed.", "Lift your shoulders up and roll them back.", "Let them drop down slowly."],
      bn: ["হাত শিথিল রেখে সোজা হয়ে বসুন বা দাঁড়ান।", "কাঁধ উপরে তুলে পেছনে ঘোরান।", "ধীরে নিচে নামতে দিন।"],
    },
    keyTip: T("Slow circles, in a range that feels easy.", "আরামদায়ক সীমায় ধীরে ঘোরান।"),
    topErrors: [T("Rushing the movement", "তাড়াহুড়ো করা")],
    practice: 0,
  },
  smile: {
    goal: T("Practise a gentle, controlled smile. This is expression practice, not face shaping.", "আলতো, নিয়ন্ত্রিত হাসির অনুশীলন। এটি মুখের আকার বদলায় না।"),
    viewpoint: "face", space: T("Good light on your face. No equipment.", "মুখে ভালো আলো। কোনো সরঞ্জাম লাগবে না।"),
    easier: T("Make a smaller smile and hold it for a shorter time.", "ছোট করে হাসুন ও কম সময় ধরে রাখুন।"),
    cautions: [FACE_STOP],
    captions: {
      en: ["Relax your face and look at the camera.", "Smile gently.", "Hold the smile.", "Relax your face."],
      bn: ["মুখ শিথিল করে ক্যামেরার দিকে তাকান।", "আলতো করে হাসুন।", "হাসিটা ধরে রাখুন।", "মুখ শিথিল করুন।"],
    },
    keyTip: T("A gentle smile is enough. Relax fully between smiles.", "আলতো হাসিই যথেষ্ট। প্রতিবারের মাঝে পুরো শিথিল হন।"),
    topErrors: [T("Turning your head away from the camera", "ক্যামেরা থেকে মাথা ঘুরিয়ে নেওয়া"), T("Not relaxing between smiles", "প্রতিবারের মাঝে শিথিল না হওয়া")],
    practice: 1,
  },
  eyebrow_raise: {
    goal: T("Practise lifting and relaxing your eyebrows.", "ভ্রু তোলা ও শিথিল করার অনুশীলন।"),
    viewpoint: "face", space: T("Good light on your face.", "মুখে ভালো আলো।"),
    easier: T("Lift a little less and hold for a shorter time.", "একটু কম তুলুন ও কম সময় ধরে রাখুন।"),
    cautions: [FACE_STOP],
    captions: {
      en: ["Relax your face and look at the camera.", "Lift your eyebrows gently.", "Hold them up.", "Relax."],
      bn: ["মুখ শিথিল করে ক্যামেরার দিকে তাকান।", "আলতো করে ভ্রু তুলুন।", "উপরে ধরে রাখুন।", "শিথিল হন।"],
    },
    keyTip: T("Keep your head still and face the camera.", "মাথা স্থির রেখে ক্যামেরার দিকে তাকান।"),
    topErrors: [T("Tilting your head back", "মাথা পেছনে হেলানো")],
    practice: 1,
  },
  cheek_puff: {
    goal: T("Practise puffing your cheeks with comfortable air.", "স্বচ্ছন্দ বাতাসে গাল ফোলানোর অনুশীলন।"),
    viewpoint: "face", space: T("Good light on your face.", "মুখে ভালো আলো।"),
    easier: T("Puff one cheek at a time, or skip this one.", "একবারে এক গাল ফোলান, বা এটি বাদ দিন।"),
    cautions: [FACE_STOP, T("Stop if you feel dizzy. Breathe normally between holds.", "মাথা ঘুরলে থামুন। প্রতিবারের মাঝে স্বাভাবিক শ্বাস নিন।")],
    captions: {
      en: ["Close your lips gently.", "Puff your cheeks with comfortable air.", "Hold.", "Breathe out and relax."],
      bn: ["ঠোঁট আলতো করে বন্ধ করুন।", "স্বচ্ছন্দ বাতাসে গাল ফোলান।", "ধরে রাখুন।", "শ্বাস ছেড়ে শিথিল হন।"],
    },
    keyTip: T("This one is experimental: count by hand if the camera misses it.", "এটি পরীক্ষামূলক: ক্যামেরা মিস করলে নিজে গুনুন।"),
    topErrors: [T("Blowing hard", "জোরে ফোলানো")],
    practice: 1,
  },
  lip_purse: {
    goal: T("Practise gently rounding and relaxing your lips.", "ঠোঁট আলতো গোল ও শিথিল করার অনুশীলন।"),
    viewpoint: "face", space: T("No equipment.", "কোনো সরঞ্জাম লাগবে না।"),
    easier: T("Make a smaller movement.", "ছোট করে করুন।"),
    cautions: [FACE_STOP],
    captions: {
      en: ["Relax your lips.", "Round your lips gently, as if to whistle, and hold.", "Relax."],
      bn: ["ঠোঁট শিথিল করুন।", "শিস দেওয়ার মতো আলতো করে ঠোঁট গোল করে ধরে রাখুন।", "শিথিল হন।"],
    },
    keyTip: T("Gentle and slow.", "আলতো ও ধীরে।"),
    topErrors: [T("Squeezing hard", "জোরে চাপ দেওয়া")],
    practice: 0,
  },
  jaw_open_close: {
    goal: T("Gentle jaw movement exactly as your clinician prescribed.", "চিকিৎসকের নির্দেশমতো চোয়ালের আলতো নড়াচড়া।"),
    viewpoint: "face", space: T("No equipment.", "কোনো সরঞ্জাম লাগবে না।"),
    easier: T("Ask your clinician before changing this exercise.", "এই ব্যায়াম বদলানোর আগে চিকিৎসকের সাথে কথা বলুন।"),
    cautions: [T("Stop if your jaw hurts, clicks painfully or locks.", "চোয়ালে ব্যথা, ব্যথাসহ শব্দ বা আটকে গেলে থামুন।")],
    captions: {
      en: ["Relax your jaw, teeth apart.", "Open your mouth slowly, only within a pain-free range.", "Close gently."],
      bn: ["চোয়াল শিথিল, দাঁত আলাদা রাখুন।", "শুধু ব্যথাহীন সীমায় ধীরে মুখ খুলুন।", "আলতো করে বন্ধ করুন।"],
    },
    keyTip: T("Pain-free range only.", "শুধু ব্যথাহীন সীমায়।"),
    topErrors: [T("Opening wide or fast", "জোরে বা দ্রুত বড় করে খোলা")],
    practice: 0,
  },
  finger_opening: {
    goal: T("Keep your fingers moving for gripping and everyday hand tasks.", "জিনিস ধরা ও দৈনন্দিন কাজে আঙুল সচল রাখে।"),
    viewpoint: "hand", space: T("Sit comfortably. No equipment.", "আরাম করে বসুন। কোনো সরঞ্জাম লাগবে না।"),
    easier: T("Open your fingers only part of the way.", "আঙুল অর্ধেক পর্যন্ত খুলুন।"),
    cautions: [STOP_UNWELL, T("Stop if your hand or wrist hurts or goes numb.", "হাত বা কব্জিতে ব্যথা বা অবশভাব হলে থামুন।")],
    captions: {
      en: ["Hold your hand up, fingers gently curled.", "Open and spread all your fingers.", "Close your hand gently."],
      bn: ["হাত তুলে ধরুন, আঙুল আলতো ভাঁজ করা।", "সব আঙুল খুলে ছড়িয়ে দিন।", "আলতো করে হাত বন্ধ করুন।"],
    },
    keyTip: T("Keep your whole hand, fingertips too, inside the picture.", "আঙুলের ডগাসহ পুরো হাত ছবির ভেতরে রাখুন।"),
    topErrors: [T("Fingertips leaving the picture", "আঙুলের ডগা ছবির বাইরে চলে যাওয়া")],
    practice: 1,
  },
});

/** The lesson for an exercise. Every catalog exercise has one; tests enforce it. */
export function lessonFor(exerciseId) {
  const lesson = LESSONS[exerciseId];
  if (!lesson) throw new Error(`No lesson for ${exerciseId}`);
  return lesson;
}

/** Pick one language from a {en, bn} text. */
export const pick = (text, lang) => (lang === "bn" ? text.bn : text.en);

/** BCP 47 voice locale for narration. */
export const voiceLocale = (lang) => (lang === "bn" ? "bn-BD" : "en-US");
