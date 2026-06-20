\set ON_ERROR_STOP on

DO $$
DECLARE
  r record;
  old_prefix text := 'https://zhobqrmkbtsqugtiahyn.databasepad.com/storage/v1/object/public/';
  new_prefix text := 'https://adcbrclppmnguzkzwiys.supabase.co/storage/v1/object/public/';
  sql text;
  updated_rows bigint;
  cast_type text;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'prj_X-ZoVQv6LKXT'
      AND (
        data_type IN ('text', 'character varying', 'json', 'jsonb')
        OR udt_name IN ('_text', '_varchar')
      )
  LOOP
    IF r.data_type IN ('json', 'jsonb') THEN
      sql := format(
        'UPDATE %I.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
        r.table_schema, r.table_name, r.column_name,
        r.column_name, old_prefix, new_prefix, r.data_type,
        r.column_name, '%' || old_prefix || '%'
      );

    ELSIF r.udt_name IN ('_text', '_varchar') THEN
      cast_type := CASE WHEN r.udt_name = '_varchar' THEN 'varchar[]' ELSE 'text[]' END;

      sql := format(
        'UPDATE %I.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
        r.table_schema, r.table_name, r.column_name,
        r.column_name, old_prefix, new_prefix, cast_type,
        r.column_name, '%' || old_prefix || '%'
      );

    ELSE
      sql := format(
        'UPDATE %I.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
        r.table_schema, r.table_name, r.column_name,
        r.column_name, old_prefix, new_prefix,
        r.column_name, '%' || old_prefix || '%'
      );
    END IF;

    EXECUTE sql;
    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows > 0 THEN
      RAISE NOTICE 'Updated %.% column %: % row(s)', r.table_name, r.column_name, r.column_name, updated_rows;
    END IF;
  END LOOP;
END $$;