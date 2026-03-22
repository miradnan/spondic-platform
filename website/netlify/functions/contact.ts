import { Handler } from "@netlify/functions";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const RECIPIENTS = [
  "miradnanali@gmail.com",
  "dan.rolfy18@gmail.com",
];

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "noreply@spondic.com";

/**
 * Escape HTML special characters to prevent XSS in the email body.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { fullName, email, organization, message } = body;

    if (!fullName || !email || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Name, email, and message are required" }),
      };
    }

    const ses = new SESClient({
      region: process.env.SES_AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.SES_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.SES_SECRET_ACCESS_KEY || "",
      },
    });

    const safeName = escapeHtml(fullName);
    const safeEmail = escapeHtml(email);
    const safeOrg = escapeHtml(organization || "Not provided");
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    const subject = `[Spondic Contact] New inquiry from ${fullName}`;

    const htmlBody = `
      <h2>New Contact Form Submission</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Organization</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeOrg}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; vertical-align: top;">Message</td>
          <td style="padding: 8px 12px;">${safeMessage}</td>
        </tr>
      </table>
      <p style="margin-top: 20px; color: #888; font-size: 12px;">
        Sent from the Spondic website contact form
      </p>
    `;

    const textBody = [
      "New Contact Form Submission",
      "",
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Organization: ${organization || "Not provided"}`,
      `Message: ${message}`,
    ].join("\n");

    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: {
          ToAddresses: RECIPIENTS,
        },
        ReplyToAddresses: [email],
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: htmlBody },
            Text: { Data: textBody },
          },
        },
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: unknown) {
    console.error("SES error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to send email" }),
    };
  }
};

export { handler };
