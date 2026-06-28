export interface AppointmentNotificationEvent {
  patient?: {
    name?: string;
    phone?: string;
  };
  appointment?: {
    id?: string;
    date?: string;
    time?: string;
    doctor_name?: string;
    clinic_name?: string;
  };
}

const DEFAULT_VARIABLE_ORDER = [
  'patient_name',
  'patient_phone',
  'appointment_id',
  'appointment_date',
  'appointment_time',
  'doctor_name',
  'clinic_name',
] as const;

export function buildAppointmentTemplateParams(
  event: AppointmentNotificationEvent,
  variableOrder: string[] = [...DEFAULT_VARIABLE_ORDER]
) {
  const values = {
    patient_name: event.patient?.name ?? '',
    patient_phone: event.patient?.phone ?? '',
    appointment_id: event.appointment?.id ?? '',
    appointment_date: event.appointment?.date ?? '',
    appointment_time: event.appointment?.time ?? '',
    doctor_name: event.appointment?.doctor_name ?? '',
    clinic_name: event.appointment?.clinic_name ?? '',
  };

  return variableOrder.map((key) => values[key as keyof typeof values] ?? '');
}
