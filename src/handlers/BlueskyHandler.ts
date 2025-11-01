import { AppBskyEmbedImages, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo, AppBskyFeedPost, AtpAgent } from '@atproto/api';
import { config } from '../config';
import { ProfileViewDetailed } from '@atproto/api/dist/client/types/app/bsky/actor/defs';
import { PostView } from '@atproto/api/dist/client/types/app/bsky/feed/defs';
import fs from 'fs';
import ffmpegBin from 'ffmpeg-static';
import { path as ffprobeBin } from 'ffprobe-static';
import { Database } from '../Database';
import { execSync } from 'child_process';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export type EmbedData = {
  type: 'image' | 'video'
  user: ProfileViewDetailed
  content: string
  likes: number
  bookmarks: number
  replies: number
  reposts: number
  quotes: number,
  videoWidth: number
  videoHeight: number
  urls: string[]
  createdAt: string
};


export class BlueskyHandler {
  static #instance: BlueskyHandler;

  ready: boolean = false;
  agent: AtpAgent;

  private constructor() {
    this.agent = new AtpAgent({
      service: 'https://bsky.social'
    });

    this.agent.login({
      identifier: config.BSKY_USERNAME!,
      password: config.BSKY_PASSWORD!
    }).then(async () => {
      await this.agent.setAdultContentEnabled(true);
      this.ready = true;
    });
  }

  public static get instance(): BlueskyHandler {
    if (!BlueskyHandler.#instance) BlueskyHandler.#instance = new BlueskyHandler();

    return BlueskyHandler.#instance;
  }

  private async waitUntilReady() {
    while (!this.ready) await wait(500);
  }

  public async getPost(did: string, key: string): Promise<PostView | undefined> {
    if (!this.ready) await this.waitUntilReady();

    const posts = await this.agent.getPosts({ uris: [`at://${did}/app.bsky.feed.post/${key}`] });

    return posts.data.posts[0];
  }

  public async getUser(name: string): Promise<ProfileViewDetailed> {
    if (!this.ready) await this.waitUntilReady();

    const response = await this.agent.getProfile({ actor: name });

    return response.data;
  }

  public async extractEmbedData(name: string, key: string, index: number = 0): Promise<EmbedData | null> {
    try {
      const user = await this.getUser(name);

      if (!user) return null;

      const post = await this.getPost(user.did, key);

      if (!post || post.record.$type != 'app.bsky.feed.post') return null;

      let isVideo = false;
      let urls: string[] = [];

      if (post.embed?.$type == 'app.bsky.embed.video#view') {
        isVideo = true;
        urls.push(`https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${user.did}&cid=${(post.embed as AppBskyEmbedVideo.View).cid}`);
      } else if (post.embed?.$type == 'app.bsky.embed.recordWithMedia#view') {
        const media = (post.embed as AppBskyEmbedRecordWithMedia.View).media;
        if (media.$type == 'app.bsky.embed.images#view') {
          urls.push(...(media as AppBskyEmbedImages.View).images.map(i => `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${user.did}&cid=${i.fullsize.split('/').at(-1)!.split('@')[0]}`));
        } else if (media.$type == 'app.bsky.embed.video#view') {
          isVideo = true;
          urls.push(`https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${user.did}&cid=${(post.embed as AppBskyEmbedVideo.View).cid}`);
        }
      } else {
        const images = (post.embed as AppBskyEmbedImages.View).images;
        if (images) urls.push(...images.map(i => `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${user.did}&cid=${i.fullsize.split('/').at(-1)!.split('@')[0]}`));
      }

      if (urls.length == 0) return null;

      const postRecord = post.record as AppBskyFeedPost.Main;

      if (isVideo && urls[0]) {
        const filePath = `${config.DATA_PATH}/${user.did.split(':')[2]}-${key}.mp4`;
        const tempPath = `${config.DATA_PATH}/${user.did.split(':')[2]}-${key}-temp.mp4`;

        if (!fs.existsSync(filePath)) {
          const res = await fetch(urls[0]);

          fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));

          const probeResult = JSON.parse(execSync(`${ffprobeBin} -v quiet -print_format json -show_format -show_streams ${filePath}`) as unknown as string);
          const videoStream = probeResult.streams.find(s => s.codec_type == 'video');

          const duration = Number(videoStream?.duration ?? '0');
          if (duration > 0 && duration < 10) {
            const loopsNeeded = Math.ceil(15 / duration);
            execSync(`${ffmpegBin} -y -stream_loop ${loopsNeeded} -i ${filePath} -c copy ${tempPath}`);

            while (!fs.existsSync(filePath) || !fs.existsSync(tempPath)) await wait(500);

            fs.rmSync(filePath);
            fs.renameSync(tempPath, filePath);

            urls[0] = `${config.URL!}/videos/${user.did.split(':')[2]}-${key}.mp4`;

            Database.instance.add(`${user.did.split(':')[2]}-${key}`);
          } else {
            fs.rmSync(filePath);
          }
        } else {
          urls[0] = `${config.URL!}/videos/${user.did.split(':')[2]}-${key}.mp4`;
        }
      }

      if (index - 1 >= urls.length) index = 0;

      if (index > 0) urls = [urls[index - 1]];

      return {
        type: isVideo ? 'video' : 'image',
        user,
        content: postRecord.text,
        likes: post.likeCount as number ?? 0,
        bookmarks: post.bookmarkCount as number ?? 0,
        replies: post.replyCount as number ?? 0,
        reposts: post.repostCount as number ?? 0,
        quotes: post.quoteCount as number ?? 0,
        createdAt: post.indexedAt as string ?? new Date().toISOString(),
        videoWidth: (postRecord.embed as AppBskyEmbedVideo.Main)?.aspectRatio?.width ?? 0,
        videoHeight: (postRecord.embed as AppBskyEmbedVideo.Main)?.aspectRatio?.height ?? 0,
        urls
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  }
}