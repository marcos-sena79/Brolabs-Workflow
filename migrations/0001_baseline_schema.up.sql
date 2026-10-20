-- Baseline: espelha o schema criado por src/server/initDb.ts.
-- Em bancos existentes é no-op (IF NOT EXISTS) e apenas registra a versão 0001.

CREATE TABLE IF NOT EXISTS boards (
  id VARCHAR(100) PRIMARY KEY,
  key VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sprint_name VARCHAR(255),
  sprint_goal TEXT,
  sprint_start_date VARCHAR(50),
  sprint_end_date VARCHAR(50),
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  epics JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  avatar TEXT,
  role VARCHAR(150),
  department VARCHAR(150),
  weekly_capacity_hours FLOAT DEFAULT 40,
  active BOOLEAN DEFAULT TRUE,
  password_hash VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(100) PRIMARY KEY,
  member_id VARCHAR(100) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(100) PRIMARY KEY,
  key VARCHAR(50) NOT NULL,
  board_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  issue_type VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  status_id VARCHAR(100) NOT NULL,
  assignee_id VARCHAR(100),
  reporter_id VARCHAR(100),
  epic_id VARCHAR(100),
  estimated_hours FLOAT DEFAULT 0,
  logged_hours FLOAT DEFAULT 0,
  story_points INT DEFAULT 0,
  due_date VARCHAR(50),
  created_at VARCHAR(50),
  updated_at VARCHAR(50),
  subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  worklogs JSONB NOT NULL DEFAULT '[]'::jsonb,
  comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(100) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  task_id VARCHAR(100),
  task_key VARCHAR(50),
  task_title VARCHAR(500),
  member_id VARCHAR(100),
  member_name VARCHAR(255),
  details TEXT,
  timestamp VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,
  channel_name VARCHAR(150),
  notify_on_task_complete BOOLEAN DEFAULT TRUE,
  notify_on_worklog BOOLEAN DEFAULT FALSE,
  notify_on_task_blocked BOOLEAN DEFAULT TRUE,
  notify_on_sprint_start BOOLEAN DEFAULT TRUE,
  last_tested_at VARCHAR(50),
  last_test_status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id VARCHAR(100) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload_summary TEXT,
  status VARCHAR(50) NOT NULL,
  timestamp VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS email_settings (
  id VARCHAR(50) PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  sender_email VARCHAR(255),
  sender_name VARCHAR(255),
  notify_on_status_change BOOLEAN DEFAULT TRUE,
  notify_on_mentions BOOLEAN DEFAULT TRUE,
  notify_reporter_on_done BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS email_notifications (
  id VARCHAR(100) PRIMARY KEY,
  trigger_type VARCHAR(50) NOT NULL,
  task_id VARCHAR(100),
  task_key VARCHAR(50),
  task_title VARCHAR(500),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  sender_name VARCHAR(255),
  subject VARCHAR(500),
  content_preview TEXT,
  html_body TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  timestamp VARCHAR(50) NOT NULL,
  read BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
