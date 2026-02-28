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
  authParams: { clientId }
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
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatOutput = document.getElementById("chatOutput");
async function sendChat(prompt) {
  if (!chatOutput || !chatInput) return;
  chatInput.disabled = true;
  if (chatSend) chatSend.disabled = true;
  const requestId = crypto.randomUUID();
  const channelName = `ai-stream:${requestId}`;
  const userDiv = document.createElement("div");
  userDiv.className = "chat-message chat-user";
  userDiv.textContent = prompt;
  chatOutput.appendChild(userDiv);
  const aiDiv = document.createElement("div");
  aiDiv.className = "chat-message chat-ai";
  chatOutput.appendChild(aiDiv);
  chatOutput.scrollTop = chatOutput.scrollHeight;
  const channel = ablyClient.channels.get(channelName);
  channel.subscribe("token", (msg) => {
    const { delta } = msg.data;
    aiDiv.textContent += delta;
    chatOutput.scrollTop = chatOutput.scrollHeight;
  });
  channel.subscribe("done", () => {
    channel.unsubscribe();
    chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;
    chatInput.focus();
  });
  channel.subscribe("error", (msg) => {
    const { message } = msg.data;
    aiDiv.textContent += `
[Error: ${message}]`;
    aiDiv.classList.add("chat-error");
    channel.unsubscribe();
    chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;
  });
  try {
    await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, requestId })
    });
  } catch {
    aiDiv.textContent += "\n[Network error: could not reach server]";
    aiDiv.classList.add("chat-error");
    channel.unsubscribe();
    chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;
  }
}
if (chatSend && chatInput) {
  chatSend.addEventListener("click", () => {
    const prompt = chatInput.value.trim();
    if (!prompt) return;
    chatInput.value = "";
    sendChat(prompt).catch(console.error);
  });
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const prompt = chatInput.value.trim();
      if (!prompt) return;
      chatInput.value = "";
      sendChat(prompt).catch(console.error);
    }
  });
}
