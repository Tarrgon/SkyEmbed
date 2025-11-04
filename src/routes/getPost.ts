import { Request, Response } from 'express';
import { BlueskyHandler } from '../handlers';
import { config } from '../config';

export async function getPostBluesky(req: Request, res: Response) {
  const forceNoLoop = (req.query['no-loop'] ?? req.query.nl) == 'true';
  const postData = await BlueskyHandler.instance.extractEmbedData(req.params.user, req.params.post, parseInt(req.params.index ?? '0'), forceNoLoop);

  const redirectUrl = `https://bsky.app/profile/${req.params.user}/post/${req.params.post}`;

  if (!postData) return res.redirect(redirectUrl);

  res.render('post-template', { post: postData, redirectUrl, config: { BASE_URL: config.BASE_URL } });
}