import dotenv from 'dotenv';

dotenv.config();

const { BSKY_USERNAME, BSKY_PASSWORD, SECURE, PRIVATE_KEY_LOCATION, CERTIFICATE_LOCATION, CHAIN_LOCATION, BASE_URL, LOOP_MAX_DURATION, PORT } = process.env;

export const config = {
  BSKY_USERNAME,
  BSKY_PASSWORD,
  SECURE: SECURE == 'true',
  PRIVATE_KEY_LOCATION,
  CERTIFICATE_LOCATION,
  CHAIN_LOCATION,
  DATA_PATH: `${__dirname}/data`,
  BASE_URL,
  LOOP_MAX_DURATION: parseInt(LOOP_MAX_DURATION as string),
  PORT: parseInt(PORT as string),
};

for (const [key, val] of Object.entries(config)) {
  if (val === undefined) {
    throw new Error(`${key} is undefined in config`);
  }
}