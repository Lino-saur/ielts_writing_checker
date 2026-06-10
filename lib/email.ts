type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim(),
    from: process.env.AUTH_EMAIL_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim()
  };
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const { apiKey, from } = getEmailConfig();

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_EMAIL_PROVIDER_NOT_CONFIGURED");
    }

    console.info("[auth-email:dev-fallback]", {
      to,
      subject,
      text
    });
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FAILED_TO_SEND_EMAIL:${response.status}:${errorText}`);
  }
}
