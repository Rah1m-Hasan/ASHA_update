import handler from "@/server/handlers/clinic.js";
import { toRouteHandler } from "@/server/node-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sharing retains the existing limit of 50 records at up to 12,000 characters each.
const route = toRouteHandler(handler, { maxBodyLength: 660000 });
export { route as GET, route as POST, route as OPTIONS };
