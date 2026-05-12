/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as paymentApproved } from './payment-approved.tsx'
import { template as paymentFailed } from './payment-failed.tsx'
import { template as subscriptionCanceled } from './subscription-canceled.tsx'
import { template as trialReminder } from './trial-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'payment-approved': paymentApproved,
  'payment-failed': paymentFailed,
  'subscription-canceled': subscriptionCanceled,
  'trial-reminder': trialReminder,
}
