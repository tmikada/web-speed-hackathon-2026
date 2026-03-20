import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import { Router } from "express";
import ffmpegPath from "ffmpeg-static";
import httpErrors from "http-errors";
import { v4 as uuidv4 } from "uuid";

import { UPLOAD_PATH } from "@web-speed-hackathon-2026/server/src/paths";
import { extractMetadataFromSound } from "@web-speed-hackathon-2026/server/src/utils/extract_metadata_from_sound";

const execFileAsync = promisify(execFile);

// 変換した音声の拡張子
const EXTENSION = "mp3";

export const soundRouter = Router();

soundRouter.post("/sounds", async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }
  if (Buffer.isBuffer(req.body) === false) {
    throw new httpErrors.BadRequest();
  }

  const soundId = uuidv4();

  // music-metadata は多フォーマット対応のため変換前に取得可能
  const { artist, title } = await extractMetadataFromSound(req.body);

  const tmpIn = path.join(os.tmpdir(), `${soundId}_in`);
  const tmpOut = path.join(os.tmpdir(), `${soundId}.mp3`);

  await fs.writeFile(tmpIn, req.body);
  try {
    const args = [
      "-i", tmpIn,
      "-vn",
    ];
    if (artist) {
      args.push("-metadata", `artist=${artist}`);
    }
    if (title) {
      args.push("-metadata", `title=${title}`);
    }
    args.push("-y", tmpOut);

    await execFileAsync(ffmpegPath!, args);
  } finally {
    await fs.unlink(tmpIn).catch(() => {});
  }

  const mp3Buffer = await fs.readFile(tmpOut);
  await fs.unlink(tmpOut).catch(() => {});

  const filePath = path.resolve(UPLOAD_PATH, `./sounds/${soundId}.${EXTENSION}`);
  await fs.mkdir(path.resolve(UPLOAD_PATH, "sounds"), { recursive: true });
  await fs.writeFile(filePath, mp3Buffer);

  return res.status(200).type("application/json").send({ artist, id: soundId, title });
});
