# LAN access (phones and tablets on the same Wi-Fi)

The production build is served on two sockets by `scripts/serve-lan.mjs`:

| Socket | URL | Purpose |
|---|---|---|
| HTTP `:3000` | `http://192.168.0.11:3000` | Loopback / desktop, and to fetch the CA cert |
| HTTPS `:8443` | `https://192.168.0.11:8443` | **Use this from phones.** Camera, microphone and the push service worker need a secure context, and `http://<lan-ip>` is not one |

## Why HTTPS is not optional

Browsers only expose `navigator.mediaDevices.getUserMedia` and
`navigator.serviceWorker` in a secure context. A phone loading
`http://192.168.0.11:3000` is treated as insecure, so the camera modules
(FaceSpeak, VitalSense, Nutrition) and caregiver push notifications silently
fail. HTTPS with a locally trusted certificate fixes this.

`crypto.randomUUID()` is also secure-context-only, so request IDs use a
`crypto.getRandomValues()` fallback (`src/lib/uuid.ts`, `public/engine/uuid.js`)
and requests still send over plain HTTP.

## Run it

```sh
npm run build
npm run serve:lan
```

The server prints every reachable address. Ports `3000` and `8443` must be open
in the host firewall (`firewall-cmd --add-port=8443/tcp --permanent &&
firewall-cmd --reload`).

### Storage for a LAN run

A production build needs Supabase or Blob credentials. Without them every
`/api/session` write fails with "Connection unavailable" and no care circle
can be created. For a demo on the LAN with no cloud account, run the build
against in-memory storage:

```sh
ASHA_MEMORY_STORE=1 ASHA_MEMORY_STORE_PRODUCTION=1 LOCAL_DEV=1 npm run serve:lan
```

`ASHA_MEMORY_STORE_PRODUCTION=1` is the explicit opt-in that lets the
production build use the in-memory store; without it the flag is ignored
outside development. Data lives in server memory and is lost on restart, so
every device on the LAN must use the same server process — which `serve:lan`
already does. `LOCAL_DEV=1` relaxes the same-origin check for local origins.

## Certificate setup

`.certs/` holds a leaf certificate for the LAN IP and the local CA that signed
it. Both are git-ignored and regenerated on demand:

```sh
mkcert -cert-file .certs/asha-lan.pem -key-file .certs/asha-lan-key.pem \
  192.168.0.11 localhost 127.0.0.1
cp "$(mkcert -CAROOT)/rootCA.pem" .certs/rootCA.pem
```

The LAN IP is assigned by DHCP and can change. Re-check it with
`hostname -I` and reissue the certificate if it moves.

### Install the CA on the phone

The phone must trust the CA or it will show a certificate warning and refuse
the camera.

1. On the phone, open `http://192.168.0.11:3000/asha-ca.pem` (or transfer
   `.certs/rootCA.pem` by cable/USB).
2. **Android** — Settings → Security → Encryption & credentials → Install a
   certificate → CA certificate. Some Android versions only trust user CAs in
   Chrome, not in other apps.
3. **iOS** — install the profile, then Settings → General → About → Certificate
   Trust Settings and enable full trust for the mkcert root.
4. Open `https://192.168.0.11:8443` and grant camera access when prompted.

## Pairing a caregiver device

Private access codes stay in the URL **fragment**, never the query string. The
patient's `/dashboard/link` page produces a link on the same origin the phone
is already using, so share `https://192.168.0.11:8443/dashboard/link#...`
directly and the caregiver opens it on their own device on the same network.

## Limits

- The build is a demonstration app, not a clinical device. It must not be
  exposed to the public internet from a workstation; deploy to the managed
  hosting target for anything beyond a LAN demo.
- The certificate is trusted only by devices that installed the CA.
