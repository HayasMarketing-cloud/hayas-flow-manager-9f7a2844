
CREATE TABLE public.liquidation_am_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_id uuid NOT NULL REFERENCES public.liquidations(id) ON DELETE CASCADE,
  am_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','issue')),
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (liquidation_id, am_user_id)
);

CREATE INDEX idx_liq_am_reviews_liq ON public.liquidation_am_reviews(liquidation_id);
CREATE INDEX idx_liq_am_reviews_am ON public.liquidation_am_reviews(am_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.liquidation_am_reviews TO authenticated;
GRANT ALL ON public.liquidation_am_reviews TO service_role;

ALTER TABLE public.liquidation_am_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Finance manage all am reviews"
  ON public.liquidation_am_reviews
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finanzas'));

CREATE POLICY "AM can view own reviews"
  ON public.liquidation_am_reviews
  FOR SELECT
  TO authenticated
  USING (am_user_id = auth.uid());

CREATE POLICY "AM can update own reviews"
  ON public.liquidation_am_reviews
  FOR UPDATE
  TO authenticated
  USING (am_user_id = auth.uid())
  WITH CHECK (am_user_id = auth.uid());

CREATE TRIGGER trg_liq_am_reviews_updated_at
BEFORE UPDATE ON public.liquidation_am_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_am_review_reviewed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('validated','issue') THEN
    NEW.reviewed_at := now();
  END IF;
  IF NEW.status = 'pending' THEN
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_liq_am_reviews_set_reviewed_at
BEFORE UPDATE ON public.liquidation_am_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_am_review_reviewed_at();

CREATE OR REPLACE FUNCTION public.get_liquidation_am_user_ids(_liquidation_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT am_id) FILTER (WHERE am_id IS NOT NULL), ARRAY[]::uuid[])
  FROM (
    SELECT
      COALESCE(
        b.am_user_id,
        c.am_user_id,
        (
          SELECT ca.user_id
          FROM public.client_assignments ca
          WHERE ca.client_id = fr.client_id
            AND ca.role = 'account_manager'
          LIMIT 1
        )
      ) AS am_id
    FROM public.liquidation_items li
    JOIN public.financial_requests fr ON fr.id = li.financial_request_id
    LEFT JOIN public.budgets b ON b.id = fr.budget_id
    LEFT JOIN public.contracts c ON c.id = fr.contract_id
    WHERE li.liquidation_id = _liquidation_id
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.notify_am_review_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liq RECORD;
  v_am_name text;
  v_total int;
  v_validated int;
  v_recipient RECORD;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT l.code, l.id, s.name AS specialist_name
    INTO v_liq
  FROM public.liquidations l
  LEFT JOIN public.specialists s ON s.id = l.specialist_id
  WHERE l.id = NEW.liquidation_id;

  SELECT COALESCE(full_name, email) INTO v_am_name
  FROM public.profiles WHERE id = NEW.am_user_id;

  IF NEW.status = 'issue' THEN
    FOR v_recipient IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('admin','finanzas')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_recipient.user_id,
        'liquidation_am_issue',
        'Incidencia en liquidación ' || COALESCE(v_liq.code,''),
        COALESCE(v_am_name,'AM') || ' ha marcado una incidencia: ' || COALESCE(NEW.notes,'(sin notas)'),
        '/liquidaciones/' || NEW.liquidation_id::text,
        jsonb_build_object('liquidation_id', NEW.liquidation_id, 'am_user_id', NEW.am_user_id)
      );
    END LOOP;
  END IF;

  IF NEW.status = 'validated' THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'validated')
      INTO v_total, v_validated
    FROM public.liquidation_am_reviews
    WHERE liquidation_id = NEW.liquidation_id;

    IF v_total > 0 AND v_total = v_validated THEN
      FOR v_recipient IN
        SELECT DISTINCT ur.user_id
        FROM public.user_roles ur
        WHERE ur.role IN ('admin','finanzas')
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
        VALUES (
          v_recipient.user_id,
          'liquidation_am_validated',
          'Liquidación ' || COALESCE(v_liq.code,'') || ' validada por todos los AM',
          'Todos los AM han validado la liquidación de ' || COALESCE(v_liq.specialist_name,''),
          '/liquidaciones/' || NEW.liquidation_id::text,
          jsonb_build_object('liquidation_id', NEW.liquidation_id)
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_liq_am_reviews_notify
AFTER UPDATE ON public.liquidation_am_reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_am_review_change();
