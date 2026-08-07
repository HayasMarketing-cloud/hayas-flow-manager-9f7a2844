/**
 * Envío de email vía Gmail API con impersonación de una cuenta @hayas.es.
 */
export function base64UrlEncode(data: Uint8Array | string): string {
  const base64 =
    typeof data === 'string' ? btoa(data) : btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createServiceAccountJWT(
  serviceAccountEmail: string,
  privateKeyPem: string,
  userToImpersonate: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountEmail,
    sub: userToImpersonate,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  const pemContent = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function getGmailAccessToken(
  serviceAccountEmail: string,
  privateKey: string,
  userEmail: string
): Promise<string> {
  const jwt = await createServiceAccountJWT(serviceAccountEmail, privateKey, userEmail);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }
  const data = await response.json();
  return data.access_token;
}

/**
 * Envía un email y devuelve el Gmail message ID (o null si falla).
 * Trazabilidad: registra en logs el id, el destinatario y el tipo de notificación.
 */
export async function sendGmail(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
  notificationType = 'unknown'
): Promise<string | null> {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(htmlContent))),
  ];

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64UrlEncode(messageParts.join('\r\n')) }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[gmail] FAILED type=${notificationType} to=${toEmail} status=${response.status} body=${body}`
    );
    return null;
  }

  const data = await response.json();
  console.log(
    `[gmail] sent type=${notificationType} to=${toEmail} messageId=${data.id} threadId=${data.threadId}`
  );
  return data.id as string;
}

