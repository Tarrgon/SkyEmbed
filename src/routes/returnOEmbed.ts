import { Request, Response } from 'express';
import { config } from '../config';

export function returnOEmbed(req: Request, res: Response) {
  return res.json({
    provider_name: `SkyEmbed - 💬 ${req.query.replies} 🔁 ${req.query.reposts} ❤️ ${req.query.likes}`,
    provider_url: config.BASE_URL,
    description: req.query.description,
    title: req.query.description,
    author_name: req.query.description
  });
}