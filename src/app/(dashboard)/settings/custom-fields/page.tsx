import { CustomFieldsSettings } from '@/components/settings/custom-fields-settings';

/** Settings → Custom fields. The header, search and actions live in
 *  CustomFieldsSettings, which also shows non-admins the list read-only. */
export default function CustomFieldsPage() {
  return <CustomFieldsSettings />;
}
