/**
 * Supabase Edge Function: Send Feedback Notification
 *
 * This function sends email notifications when new feedback is submitted.
 * It can be triggered by a database webhook on INSERT to the feedback table.
 *
 * Environment variables required:
 * - RESEND_API_KEY: API key from resend.com
 * - NOTIFICATION_EMAIL: Email address to receive notifications
 * - EMAIL_FROM: Sender email address (must be verified in Resend)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Resend } from 'https://esm.sh/resend@2.0.0';

interface FeedbackPayload {
  type: 'INSERT';
  table: 'feedback';
  record: {
    id: string;
    type: 'bug' | 'feature' | 'general';
    message: string;
    email: string | null;
    page_url: string | null;
    user_agent: string | null;
    created_at: string;
  };
  old_record: null;
}

const feedbackTypeLabels: Record<string, string> = {
  bug: 'Feil/Bug',
  feature: 'Ny funksjon',
  general: 'Generell tilbakemelding',
};

serve(async (req) => {
  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse the webhook payload
    const payload: FeedbackPayload = await req.json();

    // Only process INSERT events
    if (payload.type !== 'INSERT') {
      return new Response('Not an insert event', { status: 200 });
    }

    const feedback = payload.record;

    // Get environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const notificationEmail = Deno.env.get('NOTIFICATION_EMAIL');
    const emailFrom = Deno.env.get('EMAIL_FROM') || 'Unified Timeline <onboarding@resend.dev>';

    if (!resendApiKey || !notificationEmail) {
      console.error('Missing required environment variables: RESEND_API_KEY or NOTIFICATION_EMAIL');
      return new Response('Email configuration missing', { status: 500 });
    }

    // Create Resend client
    const resend = new Resend(resendApiKey);

    // Format email content
    const typeLabel = feedbackTypeLabels[feedback.type] || feedback.type;
    const timestamp = new Date(feedback.created_at).toLocaleString('nb-NO', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const subject = `[Unified Timeline] Ny tilbakemelding: ${typeLabel}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2a2859; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
    .label { font-weight: bold; color: #666; margin-top: 15px; }
    .value { margin: 5px 0 15px 0; }
    .message { background: white; padding: 15px; border-radius: 4px; border: 1px solid #ddd; white-space: pre-wrap; }
    .meta { font-size: 12px; color: #888; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Ny tilbakemelding mottatt</h2>
    </div>
    <div class="content">
      <div class="label">Type:</div>
      <div class="value">${typeLabel}</div>

      <div class="label">Melding:</div>
      <div class="message">${feedback.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

      ${feedback.email ? `
      <div class="label">Avsenders e-post:</div>
      <div class="value"><a href="mailto:${feedback.email}">${feedback.email}</a></div>
      ` : ''}

      <div class="meta">
        <p><strong>Tidspunkt:</strong> ${timestamp}</p>
        ${feedback.page_url ? `<p><strong>Side:</strong> ${feedback.page_url}</p>` : ''}
        <p><strong>Feedback ID:</strong> ${feedback.id}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Ny tilbakemelding mottatt i Unified Timeline

Type: ${typeLabel}

Melding:
${feedback.message}

${feedback.email ? `Avsenders e-post: ${feedback.email}` : ''}

---
Tidspunkt: ${timestamp}
${feedback.page_url ? `Side: ${feedback.page_url}` : ''}
Feedback ID: ${feedback.id}
    `.trim();

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [notificationEmail],
      subject: subject,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log(`Feedback notification sent for ID: ${feedback.id}, email ID: ${data?.id}`);

    return new Response(JSON.stringify({ success: true, emailId: data?.id }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error sending feedback notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
