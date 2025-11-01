import { Request, Response } from 'express';
import { BlueskyHandler } from '../BlueskyHandler';

export async function getPost(req: Request, res: Response) {
  const postData = await BlueskyHandler.instance.extractEmbedData(req.params.user, req.params.post, parseInt(req.params.index ?? '0'));

  const redirectUrl = `https://bsky.app/profile/${req.params.user}/post/${req.params.post}`;

  if (!postData) return res.redirect(redirectUrl);

  res.render('post-template', { post: postData, redirectUrl });
}