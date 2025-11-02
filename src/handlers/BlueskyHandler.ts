import { AppBskyEmbedImages, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo, AppBskyFeedPost, AtpAgent } from '@atproto/api';
import { ProfileViewDetailed } from '@atproto/api/dist/client/types/app/bsky/actor/defs';
import { PostView } from '@atproto/api/dist/client/types/app/bsky/feed/defs';
import { config } from '../config';
import { Database } from '../Database';
import { loopVideoIfNeeded, wait } from '../utils';

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

  public async extractEmbedData(name: string, key: string, index = 0, forceNoLoop = false): Promise<EmbedData | null> {
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

      if (isVideo && urls[0] && !forceNoLoop) {
        const videoKey = `bsky-${user.did.split(':')[2]}-${key}`;

        // Since the video key is passed into ffmpeg, ensuring it's safe is important.
        // See https://atproto.com/specs/did
        const TESTER_REGEX = /^bsky-[a-zA-Z0-9._:-]+-[a-zA-Z0-9]+$/;

        if (!Database.instance.hasVideo(videoKey)) {
          if (TESTER_REGEX.test(videoKey) && await loopVideoIfNeeded(videoKey, urls[0])) urls[0] = `${config.BASE_URL!}/videos/${videoKey}.mp4`;
        } else {
          urls[0] = `${config.BASE_URL!}/videos/${videoKey}.mp4`;
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