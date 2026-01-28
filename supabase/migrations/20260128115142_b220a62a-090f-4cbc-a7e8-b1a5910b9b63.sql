-- Allow assigned specialists to create tasks in their operational requests
CREATE POLICY "Assigned specialists can create tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  operational_request_id IN (
    SELECT orq.id 
    FROM operational_requests orq
    WHERE orq.assignee_specialist_id IN (
      SELECT s.id FROM specialists s WHERE s.user_id = auth.uid()
    )
  )
);