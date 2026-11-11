export const CONTACT_EMAIL: string;
export const CONTACT_PHONE: string;
export const INTERESTS: Readonly<Record<string, string>>;
export function buildEnquiryDraft(input: Record<string, unknown>): {
  interest: string;
  subject: string;
  body: string;
  emailUrl: string;
  whatsappUrl: string;
};
