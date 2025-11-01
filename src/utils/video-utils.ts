import { execSync } from 'child_process';
import ffmpegBin from 'ffmpeg-static';
import { path as ffprobeBin } from 'ffprobe-static';
import { config } from '../config';
import fs from 'fs';
import { wait } from './wait';
import { Database } from '../Database';

export function getVideoDuration(filePath: string): number {
  const probeResult = JSON.parse(execSync(`${ffprobeBin} -v quiet -print_format json -show_format -show_streams ${filePath}`) as unknown as string);
  const videoStream = probeResult.streams.find(s => s.codec_type == 'video');

  return Number(videoStream?.duration ?? '0');
}

export async function loopVideo(filePath: string, videoKey: string, duration: number) {
  const tempPath = `${config.DATA_PATH}/${videoKey}-temp.mp4`;

  const loopsNeeded = Math.ceil(config.LOOP_MAX_DURATION / duration);
  execSync(`${ffmpegBin} -y -stream_loop ${loopsNeeded} -i ${filePath} -c copy ${tempPath}`);

  while (!fs.existsSync(filePath) || !fs.existsSync(tempPath)) await wait(100);

  fs.rmSync(filePath);
  fs.renameSync(tempPath, filePath);
  while (!fs.existsSync(filePath)) await wait(100);
}

export async function loopVideoIfNeeded(videoKey: string, url: string): Promise<boolean> {
  const filePath = `${config.DATA_PATH}/${videoKey}.mp4`;

  const res = await fetch(url);

  fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));

  const duration = getVideoDuration(filePath);

  if (duration > 0 && duration < config.LOOP_MAX_DURATION * 0.667) {
    await loopVideo(filePath, videoKey, duration);
    Database.instance.add(videoKey);
    return true;
  } else {
    fs.rmSync(filePath);
    return false;
  }
}