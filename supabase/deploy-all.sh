#!/bin/bash
# Deploy all Supabase Edge Functions
# Run from project root: bash supabase/deploy-all.sh

set -e
PROJECT_REF="lxfgylmkexnyryafmibi"

FUNCTIONS=(
  "ai-investor-chat"
  "investor-auth-v2"
  "investor-register"
  "investor-login"
  "investor-session"
  "investor-favorites"
  "manage-deal-marketplace"
  "manage-disputes"
  "manage-market-reports"
  "manage-referrals"
  "manage-acquisitions"
  "manage-staff"
  "manage-investor-crm"
  "manage-hr-commissions"
  "manage-email-templates"
  "get-properties"
  "create-property"
  "update-property"
  "delete-property"
  "penny-deal-scoring"
  "penny-generate-description"
  "security-alerts"
  "send-notification-email"
  "send-push-notification"
  "staff-login"
  "staff-forgot-password"
)

echo "Deploying ${#FUNCTIONS[@]} edge functions to project $PROJECT_REF..."

for fn in "${FUNCTIONS[@]}"; do
  echo "  → Deploying $fn..."
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt 2>/dev/null || \
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo "✓ All edge functions deployed."
