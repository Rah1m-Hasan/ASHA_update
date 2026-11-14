// One set of model confidence thresholds for every path that creates a
// MediaPipe landmarker.
//
// Before this file the thresholds lived in five places that disagreed:
// the vision worker, the main-thread fallback in perception.js (which set
// none at all, so it silently ran on MediaPipe's 0.5 defaults), the classic
// FaceSpeak landmarker in neuroface/src/vision.js, the FingerSpeak studio
// (public/neuroface/fingerspeak.html) and the legacy Everyday app
// (public/app/everyday/platform.js). The app therefore behaved differently
// depending on which path started: whether the workers loaded, or whether it
// fell back to the main thread.
//
// These values are the worker's existing values, which are the ones already
// running in the field. Nothing here raises a threshold: hands stay at 0.55
// because tests/shared-camera-browser.mjs depends on two hands being detected,
// and face/pose stay at 0.6.
//
// neuroface/src/vision.js is a classic script and cannot import a module, so
// it keeps its own copy of the same numbers; the values below are the
// reference and both must be changed together.
//
// The two remaining paths are deliberately NOT changed, and this file records
// why:
//
//   public/neuroface/fingerspeak.html  hands 0.5/0.5/0.5
//     The studio is where a patient trains their own hand. A missed hand
//     there means the patient cannot practise, so this path stays the most
//     permissive one in the product. Raising it to 0.55 would also break the
//     two-hand contract that tests/shared-camera-browser.mjs pins.
//
//   public/app/everyday/platform.js    no thresholds set, so MediaPipe's 0.5
//     The retained Everyday companion app always uses this path, so it is
//     internally consistent; it is a separate product surface from the
//     dashboard, and raising its face threshold to 0.6 could stop a face
//     being detected in the Move and EyeSpeak modules of that app. It is
//     recorded here as a known difference rather than changed silently.

export const MODEL_THRESHOLDS = {
  face: {
    minFaceDetectionConfidence: 0.6,
    minFacePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  },
  hand: {
    minHandDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  },
  pose: {
    minPoseDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  },
};
