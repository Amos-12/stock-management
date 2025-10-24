-- Add product_deactivated to activity_action_type enum
ALTER TYPE activity_action_type ADD VALUE IF NOT EXISTS 'product_deactivated';