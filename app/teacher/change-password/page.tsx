import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { PageHeader } from "@/components/shared/page-header";

export default function Page() {
  return (
    <div>
      <PageHeader title="Change password" />
      <ChangePasswordForm />
    </div>
  );
}
