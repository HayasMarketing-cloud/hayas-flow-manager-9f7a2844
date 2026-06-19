CREATE OR REPLACE FUNCTION public.notify_am_review_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin','finanzas')
    LOOP
      INSERT INTO public.notifications (user_id, type, category, title, message, action_url, entity_id, entity_type)
      VALUES (
        v_recipient.user_id,
        'liquidation_am_issue',
        'liquidation',
        'Incidencia en liquidación ' || COALESCE(v_liq.code,''),
        COALESCE(v_am_name,'AM') || ' ha marcado una incidencia: ' || COALESCE(NEW.notes,'(sin notas)'),
        '/liquidaciones/' || NEW.liquidation_id::text,
        NEW.liquidation_id,
        'liquidation'
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
        SELECT DISTINCT ur.user_id FROM public.user_roles ur
        WHERE ur.role IN ('admin','finanzas')
      LOOP
        INSERT INTO public.notifications (user_id, type, category, title, message, action_url, entity_id, entity_type)
        VALUES (
          v_recipient.user_id,
          'liquidation_am_validated',
          'liquidation',
          'Liquidación ' || COALESCE(v_liq.code,'') || ' validada por todos los AM',
          'Todos los AM han validado la liquidación de ' || COALESCE(v_liq.specialist_name,''),
          '/liquidaciones/' || NEW.liquidation_id::text,
          NEW.liquidation_id,
          'liquidation'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;