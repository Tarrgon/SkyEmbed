import express, { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import 'source-map-support/register';
import { config } from './config';
import { Database } from './Database';
import { getPostBluesky, returnOEmbed, returnVideo } from './routes';

fs.mkdirSync(config.DATA_PATH, {
  recursive: true
});

const _http = config.SECURE ? https : http;

const serverOptions = !config.SECURE ? {} : {
  key: fs.readFileSync(config.PRIVATE_KEY_LOCATION!, { encoding: 'utf8' }),
  cert: fs.readFileSync(config.CERTIFICATE_LOCATION!, { encoding: 'utf8' }),
  ca: fs.readFileSync(config.CHAIN_LOCATION!, { encoding: 'utf8' })
};

const app = express();
app.set('trust proxy', 1);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('{/*any}/videos/:key.mp4', returnVideo);
app.get('{/*any}/oembed', returnOEmbed);

app.get('/bluesky/profile/:user/post/:post{/:index}', getPostBluesky);
app.get('/bluesky/*path', (req: Request, res: Response) => {
  res.redirect(`https://bsky.app${req.path.slice(8)}`);
});

app.get('/*path', (req: Request, res: Response) => {
  res.redirect('https://github.com/Tarrgon/SkyEmbed');
});

// @ts-ignore
const server = _http.createServer(serverOptions, app);

server.on('listening', () => {
  console.log(`LISTENING ON ${config.PORT}`);
});

server.on('error', console.error);

server.listen(config.PORT, '0.0.0.0');

Database.instance.removeLeastAccessedVideos();
setInterval(Database.instance.removeLeastAccessedVideos, 8.64e7);