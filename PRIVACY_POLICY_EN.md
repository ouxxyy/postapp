# Privacy Policy for PosturePenguin

**Last Updated:** April 22, 2026

## Overview

PosturePenguin ("we", "our", "the Extension") is a Chrome browser extension that helps users maintain good sitting posture through periodic posture detection using the device's camera. We are committed to protecting your privacy.

## Data Collection

**We do NOT collect, transmit, or share any personal data.**

Specifically:

- **Camera Images:** Camera images are processed **entirely on your local device** using TensorFlow.js (MoveNet model). Images are **never** uploaded, stored permanently, or transmitted to any server. Each image is analyzed in real-time and immediately discarded after analysis.
- **Posture Detection Results:** Detection scores and posture issue types are stored only in your browser's local storage (`chrome.storage.local`). This data never leaves your device.
- **Usage Analytics:** We do NOT use any analytics services, tracking pixels, or third-party data collection tools.
- **Third-Party Services:** We do NOT integrate with any third-party services, APIs, or cloud platforms.

## Data Storage

| Data Type                 | Storage Location                      | Retention                            |
| ------------------------- | ------------------------------------- | ------------------------------------ |
| User settings             | chrome.storage.local (device only)    | Until user clears browser data       |
| Posture detection records | chrome.storage.local (device only)    | Auto-deleted after 90 days           |
| Camera images             | Not stored — processed in memory only | Discarded immediately after analysis |

Users can manually delete all stored data at any time by clearing browser data or extension data.

## Permissions We Use

| Permission      | Purpose                                                             |
| --------------- | ------------------------------------------------------------------- |
| `storage`       | Save user preferences and posture detection history locally         |
| `alarms`        | Schedule periodic posture check reminders and daily data cleanup    |
| `notifications` | Display desktop posture reminder alerts                             |
| `tabs`          | Open full-tab pages for camera authorization prompts                |
| `offscreen`     | Create an offscreen document to access camera and run TensorFlow.js |

## Host Permission (`<all_urls>`)

The extension uses a content script on all URLs to display in-page posture reminder alerts. The content script:

- Does NOT read, collect, or modify any page content
- Does NOT inject tracking code or access DOM data
- Only displays a small modal notification when a posture issue is detected
- Activates only when the user explicitly enables posture detection

## AI / Machine Learning

The extension uses TensorFlow.js with the MoveNet SinglePose Lightning model for posture detection. This model:

- Runs **entirely on your local device** (WebGL/CPU backend)
- Model files are bundled with the extension (not downloaded at runtime)
- No image data is sent to any server for processing

## Children's Privacy

This extension does not knowingly collect data from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please contact us through the Chrome Web Store developer page or via email at the contact address listed on our store listing.

---

_PosturePenguin — Gentle guardian of your posture_
