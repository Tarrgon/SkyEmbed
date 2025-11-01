import { DatabaseSync } from 'node:sqlite';
import { config } from './config';
import path from 'path';
import fs from 'fs';

export class Database {
  static #instance: Database;

  private database: DatabaseSync;

  private constructor() {
    this.database = new DatabaseSync(path.join(config.DATA_PATH, 'data.sqlite'));
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS data(
        id INTEGER PRIMARY KEY,
        key VARCHAR NOT NULL,
        last_accessed_millis INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS index_key ON data (key);
      CREATE INDEX IF NOT EXISTS index_last_accessed_millis ON data (last_accessed_millis);
    `);
  }

  public static get instance(): Database {
    if (!Database.#instance) Database.#instance = new Database();

    return Database.#instance;
  }

  public add(key: string) {
    if (!this.database.prepare('SELECT * FROM data WHERE key = ?').get(key))
      this.database.prepare('INSERT INTO data (key, last_accessed_millis) VALUES (?, ?)').run(key, Date.now());
  }

  public has(key: string): boolean {
    return this.database.prepare('SELECT * FROM data WHERE key = ?').get(key) != null;
  }

  public delete(key: string) {
    this.database.prepare('DELETE FROM data WHERE key = ?').run(key);
  }

  public hit(key: string) {
    this.database.prepare('UPDATE data SET last_accessed_millis = ? WHERE key = ?').run(Date.now(), key);
  }

  public count(): number {
    return this.database.prepare('SELECT COUNT(*) count FROM data').get()!.count as number;
  }

  public removeOldest(count: number) {
    const data = this.database.prepare('SELECT * FROM data ORDER BY last_accessed_millis LIMIT ?').all(count) as { id: number, key: string, last_accessed_millis: number }[];

    for (const row of data) fs.rmSync(`${path.join(config.DATA_PATH, `${row.key}.mp4`)}`);

    this.database.prepare(`DELETE FROM data WHERE id IN (${data.map(r => r.id).join(',')})`).run();
  }

  public removeLeastAccessed() {
    const beforeMillis = Date.now() - 8.64e7 * 5;

    const data = this.database.prepare('SELECT * FROM data WHERE last_accessed_millis <= ?').all(beforeMillis) as { id: number, key: string, last_accessed_millis: number }[];

    for (const row of data) fs.rmSync(`${path.join(config.DATA_PATH, `${row.key}.mp4`)}`);

    if (data.length > 0) this.database.prepare('DELETE FROM data WHERE last_accessed_millis <= ?').run(beforeMillis);
  }
}