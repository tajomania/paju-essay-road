ALTER TABLE teacher_ai ADD COLUMN provider TEXT NOT NULL DEFAULT 'cloudflare';
ALTER TABLE teacher_ai ADD COLUMN model TEXT NOT NULL DEFAULT 'gemini-3.5-flash-lite';
