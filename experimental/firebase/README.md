# Raytech CG: Firebase Emulator Suite
PR #7. Dedicated local demo project: demo-raytech-cg. Functions refuse requests outside the configured local emulators. No production config or deploy command. No personal financial data.

## Run locally (Node 22 and Java available)
From repository root:
    cd experimental/firebase
    npm install
    npm run install-functions
    npm run test:emulator

For the isolated browser lab, start emulators with the local CLI:
    npx firebase emulators:start --project demo-raytech-cg --only auth,firestore,functions
In a second terminal from this folder:
    npm run serve
Open http://127.0.0.1:5173. Google sign-in at the emulator uses fake identities. In two browser windows choose the same synthetic identity. Initialize on one, modify synthetic salary, then click Sync on the other.

## Implementation
Official modular Firebase client SDK, GoogleAuthProvider, in-memory Auth persistence and HTTPS callable Functions v2. The Functions handler obtains UID from verified auth context, never from a user-selected Firestore path. Admin transactions read/verify and atomically replace the whole sealed Phase 2 envelope, with stable operation receipts. The envelope is encoded as a JSON string to preserve JSON semantics and avoid nested-map indexes; indexing is disabled for the payload. Firestore security rules deny direct access. The server validates a strict initial command subset, size and UID; no arbitrary snapshot replacement. Initialization generates only synthetic fixture data. A 700,000-byte JSON guard conservatively stops growth but is not an exact calculation of Firestore document size or index limits. No receipt deletion. The existing 369 tests and operational files stay unchanged.

Eight integration cases FB-E01–08 run with the real local Auth, Functions and Firestore emulators and simulated Google credentials. No real OAuth provider, remote Firebase project, persistent offline queue, automatic listeners, production migration, or phone/PC network deployment is included. Browser lab is explicitly manual pull and salary-only; uncertain writes are held in memory and retried via receipt. It is not the official app. Emulator login is not real Google account login. A separately authorized staging project, real Google provider configuration, browser/mobile testing, durable queue, storage partitioning, indexing and limits, privacy, and migration controls remain gates before deployment.
