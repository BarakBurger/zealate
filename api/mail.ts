/**
 * Account email: confirming an address and resetting a password. Nothing else is ever sent.
 *
 * On AWS the message goes out through SES from no-reply@zealate.com. Locally it is written to
 * ./data/outbox as a JSON file, so the links can be followed without sending real mail.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type Mail = { to: string; subject: string; text: string; html: string };
export type Mailer = (mail: Mail) => Promise<void>;

export const sesMailer = (region: string, from: string): Mailer => {
  let client: any;
  return async ({ to, subject, text, html }) => {
    const ses = await import('@aws-sdk/client-sesv2');
    client ??= new ses.SESv2Client({ region });
    await client.send(new ses.SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: text, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } } } },
    }));
  };
};

export const outboxMailer = (dir: string): Mailer => async mail => {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  await fs.writeFile(file, JSON.stringify(mail, null, 2));
  console.log(`[mail] to ${mail.to}: ${mail.subject} (${file})`);
};

export const MAIL_LANGS = ['he', 'en', 'ar', 'de', 'es', 'fr'] as const;
export type MailLang = typeof MAIL_LANGS[number];
export const mailLang = (l: unknown): MailLang => (MAIL_LANGS as readonly string[]).includes(l as string) ? l as MailLang : 'en';

type Copy = { subject: string; hello: string; body: string; button: string; ignore: string };
const COPY: Record<'verify' | 'reset', Record<MailLang, Copy>> = {
  verify: {
    en: { subject: 'Confirm your email for Zealate', hello: 'Hello', body: 'Confirm this email address to publish your books on Zealate. The link works for 48 hours.', button: 'Confirm my email', ignore: 'If you did not create a Zealate account, ignore this email.' },
    he: { subject: 'אימות האימייל שלך בזילייט', hello: 'שלום', body: 'אשרו את כתובת האימייל כדי לפרסם ספרים בזילייט. הקישור תקף ל-48 שעות.', button: 'לאימות האימייל', ignore: 'אם לא פתחתם חשבון בזילייט, אפשר להתעלם מהמייל הזה.' },
    ar: { subject: 'أكّد بريدك الإلكتروني في زيليت', hello: 'مرحباً', body: 'أكّد عنوان البريد هذا لتتمكن من نشر كتبك على زيليت. الرابط صالح لمدة 48 ساعة.', button: 'تأكيد بريدي', ignore: 'إذا لم تنشئ حساباً في زيليت، تجاهل هذه الرسالة.' },
    de: { subject: 'Bestätige deine E-Mail für Zealate', hello: 'Hallo', body: 'Bestätige diese E-Mail-Adresse, um deine Bücher auf Zealate zu veröffentlichen. Der Link gilt 48 Stunden.', button: 'E-Mail bestätigen', ignore: 'Wenn du kein Zealate-Konto angelegt hast, ignoriere diese E-Mail.' },
    es: { subject: 'Confirma tu correo en Zealate', hello: 'Hola', body: 'Confirma esta dirección de correo para publicar tus libros en Zealate. El enlace es válido durante 48 horas.', button: 'Confirmar mi correo', ignore: 'Si no creaste una cuenta en Zealate, ignora este correo.' },
    fr: { subject: 'Confirmez votre e-mail pour Zealate', hello: 'Bonjour', body: 'Confirmez cette adresse pour publier vos livres sur Zealate. Le lien est valable 48 heures.', button: 'Confirmer mon e-mail', ignore: 'Si vous n’avez pas créé de compte Zealate, ignorez cet e-mail.' },
  },
  reset: {
    en: { subject: 'Reset your Zealate password', hello: 'Hello', body: 'Someone asked to reset the password for this account. If it was you, choose a new password. The link works once, for 30 minutes.', button: 'Choose a new password', ignore: 'If you did not ask for this, ignore this email; your password stays the same.' },
    he: { subject: 'איפוס הסיסמה שלך בזילייט', hello: 'שלום', body: 'התקבלה בקשה לאפס את הסיסמה של החשבון הזה. אם זה הייתם אתם, בחרו סיסמה חדשה. הקישור עובד פעם אחת, למשך 30 דקות.', button: 'לבחירת סיסמה חדשה', ignore: 'אם לא ביקשתם את זה, התעלמו מהמייל. הסיסמה נשארת כמו שהיא.' },
    ar: { subject: 'إعادة تعيين كلمة مرورك في زيليت', hello: 'مرحباً', body: 'طلب أحدهم إعادة تعيين كلمة المرور لهذا الحساب. إن كنت أنت، اختر كلمة مرور جديدة. يعمل الرابط مرة واحدة لمدة 30 دقيقة.', button: 'اختيار كلمة مرور جديدة', ignore: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة؛ تبقى كلمة المرور كما هي.' },
    de: { subject: 'Setze dein Zealate-Passwort zurück', hello: 'Hallo', body: 'Jemand hat das Zurücksetzen des Passworts für dieses Konto angefordert. Warst du es, wähle ein neues Passwort. Der Link funktioniert einmal, 30 Minuten lang.', button: 'Neues Passwort wählen', ignore: 'Wenn du das nicht angefordert hast, ignoriere diese E-Mail; dein Passwort bleibt unverändert.' },
    es: { subject: 'Restablece tu contraseña de Zealate', hello: 'Hola', body: 'Alguien pidió restablecer la contraseña de esta cuenta. Si fuiste tú, elige una nueva. El enlace funciona una vez, durante 30 minutos.', button: 'Elegir una contraseña nueva', ignore: 'Si no lo pediste, ignora este correo; tu contraseña no cambia.' },
    fr: { subject: 'Réinitialisez votre mot de passe Zealate', hello: 'Bonjour', body: 'Une réinitialisation du mot de passe de ce compte a été demandée. Si c’est vous, choisissez un nouveau mot de passe. Le lien fonctionne une fois, pendant 30 minutes.', button: 'Choisir un nouveau mot de passe', ignore: 'Si vous n’avez rien demandé, ignorez cet e-mail ; votre mot de passe ne change pas.' },
  },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A short message in the reader's language with one button. Plain text alongside for every client. */
export const accountMail = (kind: 'verify' | 'reset', lang: MailLang, to: string, name: string, link: string): Mail => {
  const c = COPY[kind][lang];
  const dir = lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr';
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;background:#f4efe4;font-family:Arial,Helvetica,sans-serif;color:#221c15">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fbf6ea;border-radius:12px;padding:32px" dir="${dir}">
<tr><td style="font:700 22px Georgia,serif;color:#9a3412;padding-bottom:16px">Zealate</td></tr>
<tr><td style="font-size:16px;line-height:1.6;padding-bottom:8px">${esc(c.hello)} ${esc(name)},</td></tr>
<tr><td style="font-size:16px;line-height:1.6;padding-bottom:24px">${esc(c.body)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${esc(link)}" style="display:inline-block;background:#1b1510;color:#e9c98a;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${esc(c.button)}</a></td></tr>
<tr><td style="font-size:13px;color:#5b5247;line-height:1.5;word-break:break-all">${esc(link)}</td></tr>
<tr><td style="font-size:13px;color:#8a7f70;line-height:1.5;padding-top:20px">${esc(c.ignore)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${c.hello} ${name},\n\n${c.body}\n\n${c.button}: ${link}\n\n${c.ignore}\n`;
  return { to, subject: c.subject, text, html };
};
