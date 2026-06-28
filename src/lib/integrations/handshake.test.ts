import { describe, expect, it } from 'vitest';
import { buildHandshakePayload } from './handshake';

describe('buildHandshakePayload', () => {
  it('builds a CRM handshake payload with endpoint and template metadata', () => {
    const payload = buildHandshakePayload(
      {
        organization_id: 'org-123',
        crm_name: 'HubSpot',
        crm_url: 'https://hubspot.example',
      },
      {
        appointment_notification_template: 'Appointment reminder',
        appointment_notification_enabled: true,
        appointment_variable_order: ['patient_name', 'appointment_date'],
      }
    );

    expect(payload.ok).toBe(true);
    expect(payload.organization_id).toBe('org-123');
    expect(payload.supported_events).toEqual(['appointment.notification']);
    expect(payload.endpoint).toBe('/api/integrations/appointment-event');
    expect(payload.template_name).toBe('Appointment reminder');
    expect(payload.template_ready).toBe(true);
    expect(payload.required_headers).toEqual(['x-wacrm-api-key']);
  });

  it('rejects a missing organization id', () => {
    expect(() =>
      buildHandshakePayload(
        { crm_name: 'HubSpot' },
        {
          appointment_notification_template: 'Reminder',
          appointment_notification_enabled: true,
        }
      )
    ).toThrow('organization_id is required');
  });
});
