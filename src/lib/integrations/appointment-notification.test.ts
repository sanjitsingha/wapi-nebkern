import { describe, expect, it } from 'vitest';

import { buildAppointmentTemplateParams } from './appointment-notification';

describe('buildAppointmentTemplateParams', () => {
  it('builds the standard appointment variable order from event payload', () => {
    const params = buildAppointmentTemplateParams({
      patient: {
        name: 'Ayesha Rahman',
        phone: '+8801712345678',
      },
      appointment: {
        id: 'APT-1001',
        date: '2026-06-28',
        time: '10:30',
        doctor_name: 'Dr. Lina Rahman',
        clinic_name: 'City Care Hospital',
      },
    });

    expect(params).toEqual([
      'Ayesha Rahman',
      '+8801712345678',
      'APT-1001',
      '2026-06-28',
      '10:30',
      'Dr. Lina Rahman',
      'City Care Hospital',
    ]);
  });

  it('uses a custom variable order when provided', () => {
    const params = buildAppointmentTemplateParams(
      {
        patient: {
          name: 'Ayesha Rahman',
          phone: '+8801712345678',
        },
        appointment: {
          id: 'APT-1001',
          date: '2026-06-28',
        },
      },
      ['patient_name', 'appointment_id', 'appointment_date']
    );

    expect(params).toEqual(['Ayesha Rahman', 'APT-1001', '2026-06-28']);
  });
});
