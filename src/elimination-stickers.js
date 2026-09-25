import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const stickerDir = path.resolve(here, "../assets/elimination-stickers");

const STICKERS = [
  "100-2-1.webp",
  "100-2.webp",
  "100-3.webp",
  "100-4.webp",
  "100-5.webp",
  "30-2.webp",
  "30-3.webp",
  "30-5.webp",
  "50-1.webp",
  "50-4.webp",
  "70-2.webp",
  "70-3.webp",
  "70-4.webp",
];

function randomStickerPath() {
  const available = STICKERS
    .map(name => path.join(stickerDir, name))
    .filter(file => fs.existsSync(file));

  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export async function sendElimination(channel, userId, reason = "خرج من اللعبة.") {
  const file = randomStickerPath();
  const payload = {
    content: "💥 <@" + userId + "> " + reason,
  };

  if (file) {
    payload.files = [{
      attachment: file,
      name: path.basename(file),
    }];
  }

  return channel?.send(payload).catch(() => null);
}
