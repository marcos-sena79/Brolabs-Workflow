-- Remove invalid parent links without deleting or changing cards.
UPDATE tasks AS child
SET parent_id = NULL
WHERE child.parent_id IS NOT NULL
  AND (
    NOT EXISTS (
      SELECT 1
      FROM tasks AS parent
      WHERE parent.id = child.parent_id
    )
    OR EXISTS (
      SELECT 1
      FROM tasks AS parent
      WHERE parent.id = child.parent_id
        AND (
          child.board_id <> parent.board_id
          OR NOT (
            (child.issue_type = 'story' AND parent.issue_type = 'epic')
            OR (child.issue_type = 'task' AND parent.issue_type = 'story')
            OR (child.issue_type = 'bug' AND parent.issue_type = 'bug' AND parent.parent_id IS NULL)
          )
        )
    )
  );
