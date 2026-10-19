import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classify.mjs";

test("classifies Cloudflare and human gates as anti-bot", () => {
  for (const body of [
    "chat.mistral.ai\nExecutando verificação de segurança\nCloudflare",
    "Um momento… Just a moment…",
    "Confirme que você é humano",
    "Please verify you are human",
    "Solve this captcha",
  ]) {
    assert.equal(classify(body), "anti_bot_challenge", body);
  }
});

test("classifies sign-in surfaces as login walls", () => {
  for (const body of [
    "Sign in with Google",
    "Fazer login",
    "Entrar",
    "请登录",
    "微信扫码登录",
    "手机号码登录",
  ]) {
    assert.equal(classify(body), "login_wall", body);
  }
});

test("classifies a chat surface as open", () => {
  assert.equal(classify("O que você quer saber? Digite qualquer coisa"), "open");
});
