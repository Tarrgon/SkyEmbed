import { Request, Response } from 'express';
import fs from 'fs';
import { config } from '../config';
import { Database } from '../Database';

export function returnVideo(req: Request, res: Response) {
  const key = req.params.key.replaceAll(/[./\\%]/g, '');

  const p = `${config.DATA_PATH}/${key}.mp4`;

  if (!fs.existsSync(p)) return res.sendStatus(404);

  res.sendFile(p);

  Database.instance.hitVideo(key);
}