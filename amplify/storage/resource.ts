import { defineStorage } from '@aws-amplify/backend';

// Single storage bucket optimized for shared onboarding data workspace
export const storage = defineStorage({
  name: 'onboardingDataUploader',
  isDefault: true,
   access: (allow) => ({
    // Shared workspace - all authenticated users can upload, view, and manage files
    'data/*': [
        allow.groups(['onboarding-data-admins']).to(['read', 'write', 'delete']),
        allow.groups(['onboarding-data-users']).to(['read', 'write', 'delete'])
    ],
    // Admin/support area - for internal team management
    'admin/*': [
        allow.groups(['onboarding-data-admins']).to(['read', 'write', 'delete'])
    ],
    // Archive area - for completed onboarding data
    'archive/*': [
        allow.groups(['onboarding-data-admins']).to(['read', 'write', 'delete'])
    ]
   })
});



