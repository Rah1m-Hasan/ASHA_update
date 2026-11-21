// All landing-page copy and data in one place. Sections render from this file.
export const site = {
  appUrl: "/dashboard/patient",
  registerUrl: "/register",
  loginUrl: "/login",
  demoUrl: "/dashboard/patient/facespeak",
  caregiverUrl: "/dashboard/caregiver",
  sourceUrl: "https://github.com/mysunatislam/neurobridge-asha-unified-app",
};

export const nav = [
  { label: "Why Asha", href: "#why" },
  { label: "Modules", href: "#modules" },
  { label: "Kit", href: "#kit" },
  { label: "Plans", href: "#plans" },
  { label: "Team", href: "#team" },
  { label: "Contact", href: "#contact" },
];

export const hero = {
  badge: "An assistive communication companion",
  title: "A little support. A lot more independence.",
  // The headline is set as two lines; the second carries the signal blue.
  titleLines: [
    { text: "A little support.", accent: false },
    { text: "A lot more independence.", accent: true },
  ],
  lead: "When words are hard, connection shouldn’t be. Asha helps people share what they need in the way that works for them.",
  primary: { label: "Try Asha", href: site.appUrl },
  secondary: { label: "Book a guided demo", href: "#contact" },
  notes: "A prototype for assistive communication. Not a medical device or emergency service.",
  video: {
    // Add the demo video URL here when it is ready, e.g. "/videos/asha-demo.mp4".
    src: "",
    poster: undefined,
    posterAlt: "Asha companion demo",
    label: "Watch the demo",
    duration: "",
  },
};

/** The illustrative patient space drawn in the hero. Not recorded footage. */
export const heroScene = {
  eyebrow: "Your space · Here with you",
  prompt: "Would you like some water?",
  promptHint: "Your comfortable gesture. Your choice.",
  needs: ["Water", "Comfort", "Help"],
  reply: "I’m on my way.",
  signal: "Signal sent to the care circle",
  caption: "Illustrative interface — a signal becomes a message.",
};

/** The illustrative patient-to-caregiver exchange in the story section. */
export const storyThread = {
  patient: "Water, please",
  patientLabel: "Patient · one blink",
  caregiver: "On my way.",
  caregiverLabel: "Caregiver · acknowledged",
  caption: "From a blink to a reply.",
};

export const journeys = [
  { n: "Recovery", title: "Recovery & rehabilitation", text: "Support after a stroke, illness or injury." },
  { n: "Communication", title: "Complex communication needs", text: "More ways to express everyday needs." },
  { n: "Everyday care", title: "Ageing & bedside care", text: "A way to call for support when reaching is difficult." },
];

export const story = {
  eyebrow: "Why we’re building Asha",
  title: "Silence shouldn’t mean being alone.",
  // A phrase from the paragraph below, lifted out as a pull-quote.
  pullQuote: "A calmer way to communicate, shaped around what feels comfortable.",
  paragraphs: [
    "A neurological illness took our grandfather’s speech. His needs remained, but calling for help became difficult.",
    "That experience shaped Asha: flexible ways to communicate, with caregivers close by. Asha supports human care; it does not replace it.",
  ],
};

export const modulesIntro = {
  eyebrow: "Many ways to communicate",
  title: "One companion. More ways to connect.",
  lead: "Use speech, eyes, face or hands. A caregiver can help find a comfortable starting point; every module stays available.",
  rail: {
    title: "The app home",
    hint: "Choose what you want to use — every module is open in the demo.",
  },
  video: { src: "", poster: undefined, posterAlt: "Asha modules in use", label: "See the modules", duration: "" },
};

export type ModuleKey = "facespeak" | "eyespeak" | "fingerspeak" | "senseassist" | "vitalsense" | "posture" | "move" | "nutrition";
export const modules: { key: ModuleKey; name: string; title: string; text: string }[] = [
  { key: "facespeak", name: "FaceSpeak", title: "Turn a movement into a message.", text: "Practise personal blink, smile or head-movement signals. Confirm each request before it reaches a caregiver." },
  { key: "eyespeak", name: "EyeSpeak", title: "Choose words with your eyes.", text: "Look to spell or select a phrase. Eye tracking is experimental; touch and switch input remain available." },
  { key: "fingerspeak", name: "FingerSpeak", title: "Make a gesture speak.", text: "Map comfortable hand gestures to phrases, then confirm before sharing them." },
  { key: "senseassist", name: "SenseAssist", title: "Clarify speech together.", text: "Get a Bangla or English suggestion for unclear speech. The person confirms before it is shared." },
  { key: "vitalsense", name: "VitalSense", title: "Notice a pulse estimate.", text: "Experimental camera estimates are for awareness only, not clinical measurements." },
  { key: "posture", name: "Posture", title: "Check for comfort.", text: "On-device posture sensing can help a caregiver notice when repositioning may help." },
  { key: "move", name: "Move", title: "Practise at your own pace.", text: "Try short guided routines. Camera counts can miss movement; safety rules stop a session when needed." },
  { key: "nutrition", name: "Nutrition", title: "Explore meal estimates.", text: "Log a meal or try experimental photo suggestions for selected fruit. Asha gives a sourced estimate and says when it can’t tell." },
];

export const steps = [
  { n: "01", tag: "Adapt", title: "Start with the person.", text: "Set preferences and practise a comfortable signal.", side: "The caregiver" },
  { n: "02", tag: "Understand", title: "Confirm the meaning.", text: "Asha offers support; the patient confirms each request.", side: "The patient" },
  { n: "03", tag: "Connect", title: "Close the loop.", text: "Confirmed requests reach the care circle. Acknowledgements return to the patient.", side: "The caregiver" },
];

export const kit = {
  eyebrow: "Optional Asha Kit · proposed hardware add-on",
  title: "A setup that fits your space.",
  lead: "Start with a compatible phone or tablet. The optional camera, switch and mount are designed for a steadier bedside setup.",
  image: { src: "/assets/kit-placement.svg", alt: "Illustrative placement of a tablet, camera, mount and switch beside a bed" },
  caption: "Illustrative placement — not a photograph of a shipping kit.",
  price: "$100 one-time · proposed",
  priceNote: "Subscription separate · Kit optional",
  parts: [
    { key: "camera", title: "Camera + clear view", text: "Position the screen so the person can see it comfortably and the camera has a clear view of the face." },
    { key: "mount", title: "Adjustable mount", text: "Choose a secure mounting point with the caregiver. Check angle, stability and cable route." },
    { key: "switch", title: "Optional assistive switch", text: "A comfortable, reachable switch for people who prefer a physical input. Compatibility is checked first." },
  ],
  privacy: {
    title: "You control camera access",
    text: "Face, hand and posture sensing run on-device. Cloud AI is used only after opt-in.",
  },
};

export const languages = {
  greetings: [
    { text: "আমি এখানে আছি", lang: "bn" },
    { text: "I’m here", lang: "en" },
    { text: "পানি চাই", lang: "bn" },
    { text: "I need help", lang: "en" },
  ],
  title: "Bangla + English",
  text: "Communicate in Bangla, English or a mix of both.",
};

export const plans = [
  {
    audience: "Individuals & families",
    name: "Asha Plus",
    price: "$5",
    period: "/ month",
    summary: "Everyday communication with caregiver connection.",
    features: ["Eight communication and support modules", "Bangla and English support", "Confirmed caregiver requests"],
    cta: "Discuss home support",
    note: "Proposed subscription · not yet sold online",
    interest: "homecare",
  },
  {
    audience: "Advanced home care & care teams",
    name: "Asha Pro",
    price: "$12",
    period: "/ month",
    summary: "A proposed option for care teams.",
    features: ["Everything in proposed Asha Plus", "Planned AI personalisation", "Care workflow options discussed after demo"],
    cta: "Discuss a care pilot",
    note: "Proposed subscription · scope confirmed after demo",
    interest: "hospital",
    featured: true,
  },
  {
    audience: "Optional hardware add-on",
    name: "Asha Kit",
    price: "$100",
    period: "/ once",
    summary: "An optional, more stable setup.",
    features: ["Camera, switch and adjustable mount", "Phone or tablet not included", "Subscription sold separately"],
    cta: "Enquire about the kit",
    note: "Planned one-time price · compatibility check first",
    interest: "kit",
  },
] as const;

export const plansNote =
  "USD reference prices from the pitch deck — not a checkout or a payment request. The team confirms a written quote, availability and any delivery or installation scope.";

export const principles = [
  { title: "Ability first.", text: "Choose a comfortable way to communicate, with clear text and large controls." },
  { title: "Private by choice.", text: "Camera sensing runs on-device. Cloud AI needs your opt-in." },
  { title: "People stay in control.", text: "Suggestions are confirmed by the person. Asha supports human care; it does not replace it." },
];

export type SocialKey = "github" | "linkedin" | "facebook";
export const team: { name: string; role: string; photo: string; socials: Partial<Record<SocialKey, string>> }[] = [
  {
    name: "Mysunat Islam",
    role: "CEO",
    photo: "/assets/team/mysunat.webp",
    socials: {
      github: "https://github.com/mysunatislam",
      linkedin: "https://www.linkedin.com/in/mysunat-islam-8742b3242/",
      facebook: "https://www.facebook.com/mysunat.islam",
    },
  },
  {
    name: "Md Sifat Bin Jibon",
    role: "COO",
    photo: "/assets/team/jibon.webp",
    socials: {
      github: "https://github.com/Md-Sifat-Bin-Jibon",
      linkedin: "https://www.linkedin.com/in/mdsifatbinjibon/",
      facebook: "https://www.facebook.com/sifatbinjibon046",
    },
  },
  {
    name: "Hasibul Hasan Rahim",
    role: "CTO",
    photo: "/assets/team/rahim.webp",
    socials: { facebook: "https://www.facebook.com/Rah1mm" },
  },
];

export const faqs = [
  { q: "Can I try Asha without setting up a patient?", a: "Yes. Explore every module in the demo. A private care circle is only needed to test requests between devices." },
  { q: "Does Asha diagnose or handle emergencies?", a: "No. Asha is an assistive communication prototype, not a medical device or emergency service. VitalSense estimates are experimental, not clinical measurements." },
  { q: "How does the AI help?", a: "It can clarify speech and offer guidance. The person checks suggestions before sharing a request. Cloud AI requires opt-in." },
  { q: "Is Asha ready for a hospital rollout?", a: "The prototype is available to explore. Supervised validation and pilot evaluation have not yet happened." },
];

export const contact = {
  email: "mysunatislam@gmail.com",
  phoneDisplay: "01641576801",
  phoneHref: "tel:+8801641576801",
  whatsapp: "https://wa.me/8801641576801",
  whatsappLabel: "Chat with the Asha team",
  disclaimer: "Business enquiries only. Please don’t include patient names, medical records or urgent requests. This is not an emergency contact service.",
  channels: [
    { key: "email", label: "Email", value: "mysunatislam@gmail.com", href: "mailto:mysunatislam@gmail.com" },
    { key: "call", label: "Call", value: "01641576801", href: "tel:+8801641576801" },
    { key: "whatsapp", label: "WhatsApp", value: "Chat with the Asha team", href: "https://wa.me/8801641576801" },
  ],
};

export const closing = {
  title: "A little support. A world of difference.",
  primary: { label: "Try Asha", href: site.appUrl },
  secondary: { label: "Book a demo", href: "#contact" },
};

export const footer = {
  tagline: "Care that understands beyond words.",
  groups: [
    { title: "Product", links: [{ label: "Try Asha", href: site.appUrl }, { label: "Modules", href: "#modules" }, { label: "Hardware kit", href: "#kit" }, { label: "Plans", href: "#plans" }, { label: "How Asha uses AI", href: "/ai" }] },
    { title: "Company", links: [{ label: "Why Asha", href: "#why" }, { label: "Team", href: "#team" }, { label: "Contact", href: "#contact" }] },
    { title: "Connect", links: [{ label: "Email", href: "mailto:mysunatislam@gmail.com" }, { label: "WhatsApp", href: "https://wa.me/8801641576801" }, { label: "Source", href: site.sourceUrl }] },
  ],
  legal: "© 2026 ASHA / NeuroBridge · Assistive communication prototype. Not an emergency service.",
};
