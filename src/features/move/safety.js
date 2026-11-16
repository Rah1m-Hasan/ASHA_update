// The Move safety policy is shared with the Everyday Move surface.
//
// The Everyday app is a static browser app served from /public, so it cannot
// import from /src. The implementation therefore lives in
// public/app/everyday/move-safety.js, and this file re-exports it so that
// every existing import path keeps working unchanged.
export * from "../../../public/app/everyday/move-safety.js";
