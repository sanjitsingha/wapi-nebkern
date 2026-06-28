export interface CRMHandshakeContext {
  organization_id?: string;
  crm_name?: string;
  crm_url?: string;
}

export interface CRMHandshakeConfig {
  appointment_notification_template?: string | null;
  appointment_notification_enabled?: boolean;
  appointment_variable_order?: string[];
}

export interface CRMHandshakePayload {
  ok: boolean;
  organization_id?: string;
  crm_name?: string;
  crm_url?: string;
  supported_events: string[];
  endpoint: string;
  required_headers: string[];
  template_name?: string | null;
  template_ready: boolean;
  variable_order: string[];
}

export function buildHandshakePayload(
  context: CRMHandshakeContext,
  config: CRMHandshakeConfig
): CRMHandshakePayload {
  if (!context.organization_id?.trim()) {
    throw new Error('organization_id is required');
  }

  const templateName = config.appointment_notification_template?.trim() || null;

  return {
    ok: true,
    organization_id: context.organization_id.trim(),
    crm_name: context.crm_name?.trim() || 'unknown',
    crm_url: context.crm_url?.trim(),
    supported_events: ['appointment.notification'],
    endpoint: '/api/integrations/appointment-event',
    required_headers: ['x-wacrm-api-key'],
    template_name: templateName,
    template_ready: Boolean(
      config.appointment_notification_enabled && templateName
    ),
    variable_order: config.appointment_variable_order ?? [],
  };
}
