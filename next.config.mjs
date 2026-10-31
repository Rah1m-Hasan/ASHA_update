/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  async redirects() {
    const moduleQuery = { type: "query", key: "module", value: "(?<m>facespeak|fingerspeak|senseassist|vitalsense|posture)" };
    return [
      // Legacy single-page app and standalone pages now live in the dashboard.
      { source: "/app", has: [moduleQuery], destination: "/dashboard/patient/:m", permanent: false },
      { source: "/app", has: [{ type: "query", key: "role", value: "caregiver" }], destination: "/dashboard/caregiver", permanent: false },
      { source: "/app", destination: "/dashboard", permanent: false },
      { source: "/care", destination: "/dashboard/caregiver", permanent: false },
      { source: "/caregiver/:path*", destination: "/dashboard/caregiver", permanent: false },
      { source: "/patient/:path*", destination: "/dashboard/patient", permanent: false },
      { source: "/neuroface", destination: "/dashboard/patient/facespeak", permanent: false },
      { source: "/senseassist/:path*", destination: "/dashboard/patient/senseassist", permanent: false },
      { source: "/vitalsense/:path*", destination: "/dashboard/patient/vitalsense", permanent: false },
      { source: "/website", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
