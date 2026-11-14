---
type: App Guide
title: EyeSpeak gaze selection
description: Calibrated eye-gaze selection with a board that follows the measured accuracy.
tags: [asha, eyespeak, eyes, gaze]
status: draft
generated: { by: codex/2026-09-30, at: 2026-09-30T12:00:31Z }
verified: { by: process:okf-source-parity-test, at: 2026-09-30T12:00:31Z }
verification_scope: Exact guide-text match only; not clinical validation.
sources:
  - id: app-guide
    resource: https://github.com/mysunatislam/neurobridge-asha-unified-app/blob/main/server/knowledge.js
    title: Versioned Asha application guide
---

# Guidance

EyeSpeak turns where the eyes look into a selection. The caregiver calibrates first: the patient looks at each target on the board until enough steady observations are collected, and the board is chosen from the measured accuracy - nine tiles, six large tiles, or two halves of the screen. Looking at a tile for long enough selects it. A selected word proposes the need, and a separate confirmation by the patient sends it to the caregiver; looking alone never sends anything. The gaze estimate is a camera measurement, not a clinical reading: an observation that does not fit the calibration is ignored rather than acted on. Head position, blinking and low light all reduce the accuracy of the estimate, and the board adapts to what was measured rather than to an assumption about the person.
