/** Shared classification for admission probes and tests. Never solves a gate; only names it. */
export const CHALLENGE_PATTERNS = [
  /verificação de segurança/i,
  /just a moment/i,
  /cloudflare/i,
  /captcha/i,
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

export function classify(body) {
  if (CHALLENGE_PATTERNS.some(pattern => pattern.test(body))) return "anti_bot_challenge";
  if (LOGIN_PATTERNS.some(pattern => pattern.test(body))) return "login_wall";
  return "open";
}
