import { LegalPage } from "@/components/legal-page";

export default function RefundPage() {
  return <LegalPage kind="refund" operatorName={process.env.LEGAL_OPERATOR_NAME || "IELTS Writing Checker"} supportEmail={process.env.LEGAL_SUPPORT_EMAIL || "support@ielts-writing-checker.com"} />;
}
