import { query, pool } from './db';
import {
  INITIAL_BOARDS,
  INITIAL_MEMBERS,
  INITIAL_TASKS,
  INITIAL_INTEGRATIONS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_WEBHOOK_LOGS,
  INITIAL_EMAIL_SETTINGS,
  INITIAL_EMAIL_NOTIFICATIONS,
} from '../data/initialData';

export async function initializeDatabase() {
  console.log('🔄 Initializing NeonDB tables...');

  // 1. Create boards table
  await query(`
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
  `);

  // 2. Create members table
  await query(`
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
  `);

  // 3. Create sessions table (auth)
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(100) PRIMARY KEY,
      member_id VARCHAR(100) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 4. Create tasks table
  await query(`
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
  `);

  // 4. Create activity_logs table
  await query(`
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
  `);

  // 5. Create integrations table
  await query(`
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
  `);

  // 6. Create webhook_logs table
  await query(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id VARCHAR(100) PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      payload_summary TEXT,
      status VARCHAR(50) NOT NULL,
      timestamp VARCHAR(50) NOT NULL
    );
  `);

  // 7. Create email_settings table
  await query(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id VARCHAR(50) PRIMARY KEY,
      enabled BOOLEAN DEFAULT TRUE,
      sender_email VARCHAR(255),
      sender_name VARCHAR(255),
      notify_on_status_change BOOLEAN DEFAULT TRUE,
      notify_on_mentions BOOLEAN DEFAULT TRUE,
      notify_reporter_on_done BOOLEAN DEFAULT TRUE
    );
  `);

  // 8. Create email_notifications table
  await query(`
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
  `);

  // 9. Create app_settings table
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL
    );
  `);

  // 10. Migrations: add auth columns to existing members table if missing
  await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
  await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE`);

  // Ensure existing members have a default password hash (123456) so login works after migration
  const defaultHash = '$2a$12$aJlOVNw1E1GbhxlXMc1lx..mmUgs3Yo5X2vni1uhH5iDFK5r37H2.';
  await query(`UPDATE members SET password_hash = $1 WHERE password_hash IS NULL`, [defaultHash]);

  console.log('✅ NeonDB tables ready.');

  // Check if database needs initial seeding
  const boardCount = await query('SELECT COUNT(*) FROM boards');
  if (parseInt(boardCount.rows[0].count, 10) === 0) {
    console.log('🌱 Seeding initial real records into NeonDB...');
    await seedDatabase();
    console.log('✅ Seed completed successfully in NeonDB.');
  } else {
    console.log(`ℹ️ NeonDB already contains ${boardCount.rows[0].count} boards. Skipping seed.`);
  }
}

export async function seedDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing
    await client.query('DELETE FROM boards');
    await client.query('DELETE FROM members');
    await client.query('DELETE FROM tasks');
    await client.query('DELETE FROM activity_logs');
    await client.query('DELETE FROM integrations');
    await client.query('DELETE FROM webhook_logs');
    await client.query('DELETE FROM email_settings');
    await client.query('DELETE FROM email_notifications');
    await client.query('DELETE FROM app_settings');

    // Insert boards
    for (const b of INITIAL_BOARDS) {
      await client.query(
        `INSERT INTO boards (id, key, name, description, sprint_name, sprint_goal, sprint_start_date, sprint_end_date, columns, epics)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          b.id,
          b.key,
          b.name,
          b.description,
          b.sprintName,
          b.sprintGoal,
          b.sprintStartDate,
          b.sprintEndDate,
          JSON.stringify(b.columns),
          JSON.stringify(b.epics),
        ]
      );
    }

    // Insert members
    for (const m of INITIAL_MEMBERS) {
      await client.query(
        `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [m.id, m.name, m.email, m.avatar, m.role, m.department, m.weeklyCapacityHours, m.active, m.passwordHash || null]
      );
    }

    // Insert tasks
    for (const t of INITIAL_TASKS) {
      await client.query(
        `INSERT INTO tasks (
          id, key, board_id, title, description, issue_type, priority, status_id,
          assignee_id, reporter_id, epic_id, estimated_hours, logged_hours, story_points,
          due_date, created_at, updated_at, subtasks, worklogs, comments, tags, dependencies
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22
        )`,
        [
          t.id,
          t.key,
          t.boardId,
          t.title,
          t.description,
          t.issueType,
          t.priority,
          t.statusId,
          t.assigneeId,
          t.reporterId,
          t.epicId || null,
          t.estimatedHours || 0,
          t.loggedHours || 0,
          t.storyPoints || 0,
          t.dueDate,
          t.createdAt,
          t.updatedAt,
          JSON.stringify(t.subtasks || []),
          JSON.stringify(t.worklogs || []),
          JSON.stringify(t.comments || []),
          JSON.stringify(t.tags || []),
          JSON.stringify(t.dependencies || []),
        ]
      );
    }

    // Insert activity logs
    for (const a of INITIAL_ACTIVITY_LOGS) {
      await client.query(
        `INSERT INTO activity_logs (id, type, task_id, task_key, task_title, member_id, member_name, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [a.id, a.type, a.taskId, a.taskKey, a.taskTitle, a.memberId, a.memberName, a.details, a.timestamp]
      );
    }

    // Insert integrations
    for (const i of INITIAL_INTEGRATIONS) {
      await client.query(
        `INSERT INTO integrations (
          id, name, enabled, webhook_url, channel_name, notify_on_task_complete,
          notify_on_worklog, notify_on_task_blocked, notify_on_sprint_start, last_tested_at, last_test_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          i.id,
          i.name,
          i.enabled,
          i.webhookUrl,
          i.channelName,
          i.notifyOnTaskComplete,
          i.notifyOnWorklog,
          i.notifyOnTaskBlocked,
          i.notifyOnSprintStart,
          i.lastTestedAt || null,
          i.lastTestStatus || null,
        ]
      );
    }

    // Insert webhook logs
    for (const w of INITIAL_WEBHOOK_LOGS) {
      await client.query(
        `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [w.id, w.platform, w.eventType, w.payloadSummary, w.status, w.timestamp]
      );
    }

    // Insert email settings
    await client.query(
      `INSERT INTO email_settings (id, enabled, sender_email, sender_name, notify_on_status_change, notify_on_mentions, notify_reporter_on_done)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'default',
        INITIAL_EMAIL_SETTINGS.enabled,
        INITIAL_EMAIL_SETTINGS.senderEmail,
        INITIAL_EMAIL_SETTINGS.senderName,
        INITIAL_EMAIL_SETTINGS.notifyOnStatusChange,
        INITIAL_EMAIL_SETTINGS.notifyOnMentions,
        INITIAL_EMAIL_SETTINGS.notifyReporterOnDone,
      ]
    );

    // Insert email notifications
    for (const e of INITIAL_EMAIL_NOTIFICATIONS) {
      await client.query(
        `INSERT INTO email_notifications (
          id, trigger_type, task_id, task_key, task_title, recipient_email,
          recipient_name, sender_name, subject, content_preview, html_body, status, timestamp, read
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          e.id,
          e.triggerType,
          e.taskId,
          e.taskKey,
          e.taskTitle,
          e.recipientEmail,
          e.recipientName,
          e.senderName,
          e.subject,
          e.contentPreview,
          e.htmlBody,
          e.status,
          e.timestamp,
          e.read,
        ]
      );
    }

    // Insert app settings
    await client.query(
      `INSERT INTO app_settings (key, value) VALUES ('current_board_id', $1), ('current_user_id', $2)`,
      [JSON.stringify(INITIAL_BOARDS[0].id), JSON.stringify(INITIAL_MEMBERS[0].id)]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
}
