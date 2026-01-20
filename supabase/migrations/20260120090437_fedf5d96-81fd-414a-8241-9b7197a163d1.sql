-- Step 1: Drop ALL existing RLS policies on tasks table first
DROP POLICY IF EXISTS "Users can view assigned tasks" ON tasks;
DROP POLICY IF EXISTS "AM and PM can view tasks from assigned clients or budgets" ON tasks;
DROP POLICY IF EXISTS "AM and PM can create tasks for assigned clients" ON tasks;
DROP POLICY IF EXISTS "Assigned users and AM/PM can update tasks" ON tasks;
DROP POLICY IF EXISTS "AM and PM can delete tasks for assigned clients" ON tasks;
DROP POLICY IF EXISTS "AM and PM can view tasks from assigned projects" ON tasks;
DROP POLICY IF EXISTS "AM and PM can create tasks" ON tasks;
DROP POLICY IF EXISTS "AM and PM can delete tasks" ON tasks;

-- Step 2: Add operational_request_id column
ALTER TABLE tasks 
ADD COLUMN operational_request_id UUID REFERENCES operational_requests(id) ON DELETE CASCADE;

-- Step 3: Drop milestone_id column (now that policies are gone)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_milestone_id_fkey;
ALTER TABLE tasks DROP COLUMN milestone_id;

-- Step 4: Drop milestones table
DROP TABLE IF EXISTS milestones CASCADE;

-- Step 5: Create new RLS policies
CREATE POLICY "Users can view assigned tasks" ON tasks
FOR SELECT USING (
  assignee_user_id = auth.uid() OR
  assignee_specialist_id IN (
    SELECT id FROM specialists WHERE user_id = auth.uid()
  )
);

CREATE POLICY "AM and PM can view tasks from assigned projects" ON tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM operational_requests orq
    JOIN operational_projects op ON orq.operational_project_id = op.id
    WHERE orq.id = tasks.operational_request_id
    AND (op.owner_user_id = auth.uid() OR op.created_by = auth.uid())
  )
);

CREATE POLICY "AM and PM can create tasks" ON tasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM operational_requests orq
    JOIN operational_projects op ON orq.operational_project_id = op.id
    WHERE orq.id = operational_request_id
    AND (op.owner_user_id = auth.uid() OR op.created_by = auth.uid())
  )
);

CREATE POLICY "Assigned users and AM/PM can update tasks" ON tasks
FOR UPDATE USING (
  assignee_user_id = auth.uid() OR
  assignee_specialist_id IN (SELECT id FROM specialists WHERE user_id = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM operational_requests orq
    JOIN operational_projects op ON orq.operational_project_id = op.id
    WHERE orq.id = tasks.operational_request_id
    AND (op.owner_user_id = auth.uid() OR op.created_by = auth.uid())
  )
);

CREATE POLICY "AM and PM can delete tasks" ON tasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM operational_requests orq
    JOIN operational_projects op ON orq.operational_project_id = op.id
    WHERE orq.id = tasks.operational_request_id
    AND (op.owner_user_id = auth.uid() OR op.created_by = auth.uid())
  )
);

-- Step 6: Create index
CREATE INDEX IF NOT EXISTS idx_tasks_operational_request_id ON tasks(operational_request_id);