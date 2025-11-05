import { Request, Response } from 'express';

export function returnOEmbed(req: Request, res: Response) {
  return res.json({
    provider_name: `SkyEmbed - 💬 ${req.query.replies} 🔁 ${req.query.reposts} ❤️ ${req.query.likes}`,
    author_url: req.query.url,
    provider_url: req.query.url,
    description: req.query.description,
    title: req.query.description,
    author_name: req.query.description
  });
}