function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function unsubscribePageHtml(options: {
  title: string;
  message: string;
  success: boolean;
  token?: string;
  showConfirm?: boolean;
}): string {
  const title = escapeHtml(options.title);
  const message = escapeHtml(options.message);
  const token = options.token ? escapeHtml(options.token) : "";

  const confirmForm =
    options.showConfirm && options.token
      ? `<form method="post" action="/alerts/unsubscribe" style="margin-top:20px;">
  <input type="hidden" name="token" value="${token}" />
  <button type="submit" style="cursor:pointer;border:0;border-radius:8px;padding:10px 16px;font-size:14px;font-family:inherit;background:#111;color:#fff;">
    Unsubscribe from all Pathway emails
  </button>
</form>
<p style="margin:12px 0 0;font-size:13px;color:#666;">This stops all Pathway alert emails.</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Pathway</title>
  </head>
  <body style="margin:0;padding:40px 24px;font-family:Georgia,serif;background:#f6f6f4;color:#111;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e5e0;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Pathway Alerts</p>
      <h1 style="margin:0 0 12px;font-size:24px;">${title}</h1>
      <p style="margin:0;font-size:16px;line-height:1.5;color:#333;">${message}</p>
      ${confirmForm}
    </div>
  </body>
</html>`;
}
