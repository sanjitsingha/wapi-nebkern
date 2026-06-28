import { TemplateManager } from '@/components/settings/template-manager';

export default function TemplatesPage() {
  return (
    <div>
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Templates
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage message templates and submit them to Meta for approval.
        </p>
      </div>

      <div className="mt-6">
        <TemplateManager />
      </div>
    </div>
  );
}
