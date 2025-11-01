import dotenv from 'dotenv';

dotenv.config();

const { BSKY_USERNAME, BSKY_PASSWORD, SECURE, PRIVATE_KEY_LOCATION, CERTIFICATE_LOCATION, CHAIN_LOCATION, URL, PORT } = process.env;

export const config = {
  BSKY_USERNAME,
  BSKY_PASSWORD,
  SECURE: SECURE == 'true',
  PRIVATE_KEY_LOCATION,
  CERTIFICATE_LOCATION,
  CHAIN_LOCATION,
  DATA_PATH: `${__dirname}/data`,
  URL,
  PORT: parseInt(PORT as string),
};

for (const [key, val] of Object.entries(config)) {
  if (val === undefined) {
    throw new Error(`${key} is undefined in config`);
  }
}