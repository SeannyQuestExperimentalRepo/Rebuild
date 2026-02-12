import "server-only";

/**
 * Email notification service.
 *
 * Uses Resend (recommended) for transactional email. Falls back gracefully
 * when RESEND_API_KEY is not configured — logs instead of sending.
 *
 * To switch providers, replace the sendEmail implementation.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM ?? "TrendLine <noreply@trendline.app>";

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a transactional email via Resend API.
 * Returns true on success, false on failure. Never throws.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[email] Would send to ${opts.to}: ${opts.subject} (no API key configured)`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[email] Resend API error (${res.status}):`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

interface TrendAlertGame {
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  spread: number | null;
  overUnder: number | null;
}

/**
 * Send a trend alert email when a saved trend triggers on today's games.
 */
export async function sendTrendAlertEmail(
  to: string,
  trendName: string,
  trendDescription: string | null,
  matchedGames: TrendAlertGame[],
): Promise<boolean> {
  const gameRows = matchedGames
    .map((g) => {
      const spread = g.spread != null ? (g.spread > 0 ? `+${g.spread}` : `${g.spread}`) : "N/A";
      const total = g.overUnder != null ? `${g.overUnder}` : "N/A";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${g.awayTeam} @ ${g.homeTeam}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${spread}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a">${total}</td>
        </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="margin:0;font-size:24px;color:#14b8a6">TrendLine</h1>
    </div>
    <div style="background:#161618;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:13px;color:#71717a">Your saved trend is active today</p>
      <h2 style="margin:0 0 8px;font-size:20px;color:#fafafa">${escapeHtml(trendName)}</h2>
      ${trendDescription ? `<p style="margin:0 0 16px;font-size:14px;color:#a1a1aa">${escapeHtml(trendDescription)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#d4d4d8">
        <thead>
          <tr style="text-align:left;color:#71717a;font-size:12px">
            <th style="padding:8px 12px;border-bottom:1px solid #2a2a2a">Game</th>
            <th style="padding:8px 12px;border-bottom:1px solid #2a2a2a">Spread</th>
            <th style="padding:8px 12px;border-bottom:1px solid #2a2a2a">Total</th>
          </tr>
        </thead>
        <tbody>${gameRows}</tbody>
      </table>
    </div>
    <div style="text-align:center">
      <a href="${process.env.NEXTAUTH_URL || "https://trendline.app"}/trends/saved"
         style="display:inline-block;padding:10px 24px;background:#14b8a6;color:#0a0a0f;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        View on TrendLine
      </a>
    </div>
    <p style="margin-top:32px;text-align:center;font-size:12px;color:#52525b">
      You received this because you enabled email alerts for this trend.
      <a href="${process.env.NEXTAUTH_URL || "https://trendline.app"}/trends/saved" style="color:#71717a">Manage preferences</a>
    </p>
  </div>
</body>
</html>`;

  return sendEmail({
    to,
    subject: `Your trend "${trendName}" is active today`,
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
