# Feature flags

`public/app/everyday/contracts.js` exports the explicit code flags. They describe implemented capability, not clinical clearance or remote entitlement. The existing assistive modules are unchanged and independently reachable at `/app`.

| Flag                                        | State | Meaning                                                                                                                      |
| ------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| Nutrition / Move / EyeSpeak / Care / Clinic | On    | Independently usable interactive code paths; camera and cloud require explicit action/consent                                |
| Food vision                                 | **On** | A YOLOv8n-seg instance segmenter (FoodSeg103, 104 ingredient classes) runs in the browser. It offers catalogue candidates; the person confirms every one. It cannot name a Bangladeshi dish. |
| Offline ASR                                 | Off   | Browser ASR is optional; no Whisper pack installed                                                                           |
| Clinical release                            | Off   | Symptom protocol review/validation is pending                                                                                |
| Signed release packs                        | Off   | Verification/install/rollback/eviction infrastructure is tested, but no production trust key or signed release is configured |

Weights already bundled in the repo are lazy loaded with pinned SHA-256 and size checks. MediaPipe GPU failure falls back to CPU/WASM. One model runs at a time; inference scheduling adapts downward when it takes longer. Camera permission denial keeps touch, manual logging, journals and switch scanning usable.

Food vision is on because its conditions are now met: the weights are licensed (AGPL-3.0 weights
over an Apache-2.0 dataset, recorded in `public/models/FOODSEG-LICENSE.txt`), the runtime is
vendored and pinned, and the segmentation has been evaluated (region F1 61.9 % over 200
FoodSeg103 validation images, in-domain). Two conditions are **not** met and are stated wherever
it matters: the evaluation is in-domain rather than held-out for Bangladeshi food, and the
portion estimate has not been measured at all. `FEATURES.foodVision` therefore describes a
segmenter that offers candidates for a person to confirm - not a recogniser.

Activating a *dish* recogniser, or releasing portion estimates, requires a labelled Bangladeshi
food dataset and a weighed-and-photographed plate dataset respectively. Activating signed packs requires an operator-controlled offline signing key, pinned public trust key, signed manifests and release/rollback testing. The private signing key must never be put in this repository. Clinical release cannot be enabled by a UI checkbox or an LLM response.
