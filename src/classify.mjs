/** Shared classification for admission probes and tests. Never solves a gate; only names it. */
export const CHALLENGE_PATTERNS = [
  /verificação de segurança/i,
  /just a moment/i,
  /cloudflare/i,
  /confirme que voc[eê] [eé] humano/i,
  /are you a robot/i,
  /verify you are human/i,
];

export const LOGIN_PATTERNS = [
  /sign in/i,
  /log in/i,
  /fazer login/i,
  /entrar/i,
  /登录/i,
  /scan.*qr|二维码/i,
  /手机号|phone number/i,
];

/** Page-level text gate. A bare "captcha" mention is only a gate on a small challenge page. */
export function detectGateText(body) {
  const text = typeof body === "string" ? body : "";
  if (/confirme sua idade/i.test(text)) return "age_confirmation";
  if (CHALLENGE_PATTERNS.some(pattern => pattern.test(text))) return "anti_bot_challenge";
  if (/captcha/i.test(text) && text.length < 2_000) return "captcha";
  return null;
}

export function classify(body) {
  if (detectGateText(body)) return detectGateText(body) === "age_confirmation" ? "age_gate" : "anti_bot_challenge";
  if (LOGIN_PATTERNS.some(pattern => pattern.test(body))) return "login_wall";
  return "open";
}
