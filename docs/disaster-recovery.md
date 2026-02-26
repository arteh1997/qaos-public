# Disaster Recovery Plan

## Supabase Backups

### Automatic Backups (Enabled by Default)
- **Free/Pro plans**: Daily backups, 7-day retention
- **Team/Enterprise plans**: Daily backups, 30-day retention + Point-in-Time Recovery (PITR)

### Enable Point-in-Time Recovery (PITR)
1. Go to **Supabase Dashboard > Project Settings > Database > Backups**
2. Enable PITR (requires Team plan or higher)
3. PITR allows recovery to any second within the retention window

### Manual Backup (pg_dump)
For an independent backup layer, schedule a pg_dump export:

```bash
# Export schema + data
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --format=custom \
  --no-owner \
  -f backup_$(date +%Y%m%d_%H%M%S).dump

# Upload to S3/GCS (example with AWS CLI)
aws s3 cp backup_*.dump s3://your-backup-bucket/supabase/
```

Consider running this as a weekly cron job or GitHub Action.

## Recovery Procedures

### Accidental Data Deletion (Single Table/Rows)
1. If PITR is enabled: restore to the point just before deletion via Supabase Dashboard
2. If only daily backups: restore from the latest daily backup to a staging project, then selectively copy the needed data

### Schema Corruption
1. Identify the problematic migration in `supabase/migrations/`
2. Write a corrective migration to fix the schema
3. Apply via `supabase db push` or manually in SQL Editor
4. If unrecoverable: restore from backup

### Full Database Restore
1. Create a new Supabase project (or use existing staging)
2. Restore from backup: **Dashboard > Database > Backups > Restore**
3. Update environment variables to point to the restored project
4. Verify data integrity with spot checks on key tables

### Application Down (Vercel)
1. Check Vercel status page: https://www.vercel-status.com/
2. If Vercel is healthy, check deployment logs for errors
3. Roll back to previous deployment: **Vercel Dashboard > Deployments > ... > Promote to Production**

## Data Retention Policy

The following tables grow unbounded and should have retention policies:

| Table | Recommended Retention | Action |
|-------|----------------------|--------|
| `audit_logs` | 12 months | Archive to cold storage, delete from live DB |
| `stock_history` | 24 months | Archive to cold storage, delete from live DB |
| `haccp_temperature_logs` | 12 months (regulatory minimum) | Archive, keep accessible for inspections |
| `haccp_checks` | 12 months | Archive alongside temperature logs |
| `pos_sale_events` | 6 months | Delete after reconciliation |
| `billing_events` | 24 months | Keep for tax/audit compliance |
| `alert_history` | 3 months | Delete old alerts |

### Implementing Retention

Create a scheduled Supabase Edge Function or cron job:

```sql
-- Example: archive audit_logs older than 12 months
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '12 months';
```

Run this monthly via the `/api/cron/` endpoint pattern already in the codebase.

## Contacts & Escalation

| Service | Support Link |
|---------|-------------|
| Supabase | https://supabase.com/dashboard/support |
| Vercel | https://vercel.com/help |
| Stripe | https://support.stripe.com/ |
| Sentry | https://sentry.io/support/ |
