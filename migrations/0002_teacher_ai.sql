CREATE TABLE teacher_ai (
  teacher_id TEXT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'shared' CHECK(mode IN ('shared','personal','disabled')),
  account_id TEXT NOT NULL DEFAULT '',
  token_cipher TEXT NOT NULL DEFAULT '',
  daily_limit INTEGER NOT NULL DEFAULT 150,
  updated TEXT NOT NULL
);
