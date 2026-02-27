"use strict";
const indicator = document.getElementById("connectionIndicator");
const canvas = document.getElementById("canvas");
if (canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
const clientId = `user-${crypto.randomUUID()}`;
const ablyClient = new Ably.Realtime({
  authUrl: "/auth",
  authParams: { clientId },
  clientId
});
const spaces = new Spaces(ablyClient);
async function init() {
  const space = await spaces.get("canvas-room");
  ablyClient.connection.on("connected", () => indicator?.classList.add("connected"));
  ablyClient.connection.on("disconnected", () => indicator?.classList.remove("connected"));
  ablyClient.connection.on("closed", () => indicator?.classList.remove("connected"));
  await space.enter();
  space.locations.subscribe("update", (locationUpdate) => {
    if (locationUpdate.member.clientId === clientId) return;
    const loc = locationUpdate.currentLocation;
    if (!loc || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(0, 150, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(loc.x, loc.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  if (canvas) {
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgba(255, 100, 0, 0.8)";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      space.locations.set({ x, y });
    });
  }
}
init().catch(console.error);
