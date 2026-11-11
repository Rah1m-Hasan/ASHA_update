import handler from "@/server/handlers/session.js";
import { toRouteHandler } from "@/server/node-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const route = toRouteHandler(handler);
export { route as GET, route as POST, route as OPTIONS };
