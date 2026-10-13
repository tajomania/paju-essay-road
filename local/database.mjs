import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
export function openDatabase(filename, migrations) {
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY);",
  );
  for (const name of fs
    .readdirSync(migrations)
    .filter((n) => n.endsWith(".sql"))
    .sort())
    if (
      !db.prepare("SELECT name FROM schema_migrations WHERE name=?").get(name)
    ) {
      db.exec("BEGIN");
      try {
        db.exec(fs.readFileSync(path.join(migrations, name), "utf8"));
        db.prepare("INSERT INTO schema_migrations VALUES (?)").run(name);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
  function prepare(sql, args = []) {
    return {
      bind(...values) {
        return prepare(sql, values);
      },
      first() {
        return db.prepare(sql).get(...args) || null;
      },
      all() {
        return { results: db.prepare(sql).all(...args) };
      },
      run() {
        return db.prepare(sql).run(...args);
      },
    };
  }
  return {
    prepare,
    batch(statements) {
      db.exec("BEGIN");
      try {
        const results = statements.map((s) => s.run());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close() {
      db.close();
    },
  };
}
