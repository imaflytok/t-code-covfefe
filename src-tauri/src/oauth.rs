//! In-app loopback PKCE OAuth for the Trump Code app.
//!
//! Implements the OAuth Authorization-Code-with-PKCE flow for two subscription
//! backends:
//!   * `anthropic` — Claude subscription (Claude Code OAuth client).
//!   * `openai`    — ChatGPT / Codex subscription.
//!
//! The flow runs entirely in-app:
//!   1. We bind a loopback `TcpListener` to receive the OAuth redirect.
//!   2. We open the provider's authorize URL in the system browser.
//!   3. We accept exactly one inbound HTTP request, pull `code`/`state` from the
//!      request line, validate `state`, and serve a tiny "return to the app" page.
//!   4. We exchange the code for tokens at the provider token endpoint
//!      (POST `application/x-www-form-urlencoded`).
//!   5. We persist a JSON token bundle in the OS keychain (reusing
//!      `secrets.rs`, service `"trump-code"`, account `"oauth:<provider>"`).
//!
//! Token bundles are refreshed transparently by [`oauth_access_token`] when the
//! access token is near expiry.

use base64::Engine;
use rand::Rng;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{SystemTime, UNIX_EPOCH};

/// Keychain service name shared with `secrets.rs`.
const KEYCHAIN_SERVICE: &str = "trump-code";

/// base64url-no-pad engine, used for PKCE verifier/challenge and JWT decoding.
const B64_URL_NOPAD: base64::engine::GeneralPurpose = base64::engine::general_purpose::URL_SAFE_NO_PAD;

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/// Generate a PKCE `code_verifier`: a high-entropy, URL-safe random string.
///
/// RFC 7636 requires 43–128 characters from the unreserved set
/// `[A-Z a-z 0-9 - . _ ~]`. We emit base64url-no-pad of 64 random bytes, which
/// yields 86 characters drawn from `[A-Z a-z 0-9 - _]` — comfortably inside the
/// allowed range and charset.
pub fn generate_code_verifier() -> String {
    let mut bytes = [0u8; 64];
    rand::thread_rng().fill(&mut bytes);
    B64_URL_NOPAD.encode(bytes)
}

/// Derive the PKCE `code_challenge` for the S256 method:
/// `base64url_nopad(sha256(verifier))`.
pub fn code_challenge_s256(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    B64_URL_NOPAD.encode(digest)
}

/// Generate an opaque `state` value used for CSRF protection on the redirect.
fn generate_state() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    B64_URL_NOPAD.encode(bytes)
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

/// Static OAuth configuration for one provider. All values are the verified,
/// literal client/endpoint constants from the OAuth specs.
struct ProviderConfig {
    /// Public PKCE client id.
    client_id: &'static str,
    /// Browser authorize endpoint.
    authorize_url: &'static str,
    /// Token exchange / refresh endpoint.
    token_url: &'static str,
    /// Space-separated OAuth scopes.
    scopes: &'static str,
    /// `true` => bind a fixed loopback port (`fixed_port`); `false` => OS-chosen
    /// random free port (bind to port 0).
    fixed_port: Option<u16>,
    /// Redirect path appended to `http://localhost:<port>` (e.g. `/callback`).
    redirect_path: &'static str,
    /// Extra static query params appended to the authorize URL.
    extra_authorize_params: &'static [(&'static str, &'static str)],
}

/// Resolve the [`ProviderConfig`] for a provider id, or an error for unknown ids.
fn provider_config(provider: &str) -> Result<ProviderConfig, String> {
    match provider {
        // ANTHROPIC — Claude subscription (Claude Code public PKCE client).
        "anthropic" => Ok(ProviderConfig {
            client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
            authorize_url: "https://claude.ai/oauth/authorize",
            token_url: "https://platform.claude.com/v1/oauth/token",
            scopes: "user:profile user:inference user:sessions:claude_code user:mcp_servers",
            // Random free loopback port.
            fixed_port: None,
            redirect_path: "/callback",
            extra_authorize_params: &[],
        }),
        // OPENAI — ChatGPT / Codex subscription (public PKCE client).
        "openai" => Ok(ProviderConfig {
            client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
            authorize_url: "https://auth.openai.com/oauth/authorize",
            token_url: "https://auth.openai.com/oauth/token",
            scopes: "openid profile email offline_access",
            // FIXED port 1455, path /auth/callback — required by the OpenAI client.
            fixed_port: Some(1455),
            redirect_path: "/auth/callback",
            extra_authorize_params: &[
                ("id_token_add_organizations", "true"),
                ("codex_cli_simplified_flow", "true"),
                ("originator", "trumpcode"),
            ],
        }),
        other => Err(format!("unknown oauth provider: {other}")),
    }
}

/// Build the provider authorize URL for the given config, redirect URI, state,
/// and PKCE challenge. Pure (no IO) so the wire shape can be unit-tested. All
/// dynamic values are percent-encoded; the static `extra_authorize_params` are
/// appended last.
fn build_authorize_url(
    cfg: &ProviderConfig,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> String {
    let mut url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
        cfg.authorize_url,
        urlencoding::encode(cfg.client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(cfg.scopes),
        urlencoding::encode(state),
        urlencoding::encode(code_challenge),
    );
    for (k, v) in cfg.extra_authorize_params {
        url.push('&');
        url.push_str(&urlencoding::encode(k));
        url.push('=');
        url.push_str(&urlencoding::encode(v));
    }
    url
}

// ---------------------------------------------------------------------------
// Persisted token bundle
// ---------------------------------------------------------------------------

/// The JSON bundle persisted to the keychain under `oauth:<provider>`.
#[derive(serde::Serialize, serde::Deserialize, Clone, Default)]
struct TokenBundle {
    access_token: String,
    #[serde(default)]
    refresh_token: String,
    /// Absolute unix expiry (seconds). 0 means "unknown / never expires".
    #[serde(default)]
    expires_at_unix: u64,
    /// ChatGPT account id (OpenAI only; empty otherwise).
    #[serde(default)]
    account_id: String,
}

/// Value returned to the frontend by [`oauth_access_token`].
#[derive(serde::Serialize)]
pub struct AccessToken {
    access_token: String,
    account_id: String,
}

/// Decide whether a token bundle needs to be refreshed: it does when it has a
/// known expiry (`expires_at_unix != 0`) that falls within 60 seconds of `now`.
/// An expiry of 0 ("unknown / never expires") never triggers a refresh. Pure so
/// the expiry decision can be unit-tested without touching the clock or network.
fn bundle_needs_refresh(bundle: &TokenBundle, now: u64) -> bool {
    bundle.expires_at_unix != 0 && bundle.expires_at_unix <= now + 60
}

fn keychain_account(provider: &str) -> String {
    format!("oauth:{provider}")
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Load a token bundle from the keychain, or `None` if not present.
fn load_bundle(provider: &str) -> Result<Option<TokenBundle>, String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &keychain_account(provider))
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(json) => {
            let bundle: TokenBundle = serde_json::from_str(&json).map_err(|e| e.to_string())?;
            Ok(Some(bundle))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Persist a token bundle to the keychain.
fn save_bundle(provider: &str, bundle: &TokenBundle) -> Result<(), String> {
    let json = serde_json::to_string(bundle).map_err(|e| e.to_string())?;
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &keychain_account(provider))
        .map_err(|e| e.to_string())?;
    entry.set_password(&json).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// JWT helper (OpenAI id_token)
// ---------------------------------------------------------------------------

/// Decode the *payload* of a JWT without verifying its signature, returning it as
/// a `serde_json::Value`. A JWT is `header.payload.signature`; we base64url-decode
/// the middle segment. We do NOT verify the signature — we only read claims from a
/// token the provider just minted for us over TLS.
fn decode_jwt_payload(jwt: &str) -> Result<serde_json::Value, String> {
    let payload_b64 = jwt
        .split('.')
        .nth(1)
        .ok_or_else(|| "id_token is not a well-formed JWT".to_string())?;
    let bytes = B64_URL_NOPAD
        .decode(payload_b64)
        .map_err(|e| format!("failed to base64url-decode JWT payload: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("failed to parse JWT payload JSON: {e}"))
}

/// Pull the ChatGPT account id out of a decoded id_token payload.
///
/// The account id can live in a few places depending on flow:
///   * `https://api.openai.com/auth` -> `chatgpt_account_id`
///   * a top-level `chatgpt_account_id`
///   * an `organization_id` style claim
/// We probe them in order and return the first non-empty string we find.
fn extract_chatgpt_account_id(payload: &serde_json::Value) -> String {
    // Nested under the OpenAI auth namespace claim.
    if let Some(auth) = payload.get("https://api.openai.com/auth") {
        if let Some(id) = auth.get("chatgpt_account_id").and_then(|v| v.as_str()) {
            if !id.is_empty() {
                return id.to_string();
            }
        }
        if let Some(id) = auth.get("organization_id").and_then(|v| v.as_str()) {
            if !id.is_empty() {
                return id.to_string();
            }
        }
    }
    // Flat claims.
    for key in ["chatgpt_account_id", "organization_id", "org_id"] {
        if let Some(id) = payload.get(key).and_then(|v| v.as_str()) {
            if !id.is_empty() {
                return id.to_string();
            }
        }
    }
    String::new()
}

// ---------------------------------------------------------------------------
// HTTP loopback helpers
// ---------------------------------------------------------------------------

/// Parse the `code` and `state` query params out of the first line of an HTTP
/// request (e.g. `GET /callback?code=abc&state=xyz HTTP/1.1`).
fn parse_callback_query(request_line: &str) -> (Option<String>, Option<String>) {
    // request_line looks like: "GET /callback?code=...&state=... HTTP/1.1"
    let mut code = None;
    let mut state = None;
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    if let Some((_, query)) = path.split_once('?') {
        for pair in query.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                let decoded = urlencoding::decode(v)
                    .map(|c| c.into_owned())
                    .unwrap_or_else(|_| v.to_string());
                match k {
                    "code" => code = Some(decoded),
                    "state" => state = Some(decoded),
                    _ => {}
                }
            }
        }
    }
    (code, state)
}

/// Minimal HTML page served to the browser after capturing the redirect.
fn success_html() -> String {
    let body = "<!doctype html><html><head><meta charset=\"utf-8\">\
<title>Trump Code</title></head>\
<body style=\"font-family:system-ui;background:#111;color:#eee;text-align:center;padding:4rem\">\
<h1>You're signed in.</h1>\
<p>You can close this tab and return to Trump Code.</p>\
</body></html>";
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    )
}

/// Outcome of accepting a single loopback connection.
struct CallbackResult {
    code: String,
    state: String,
}

/// Block until exactly one inbound HTTP request arrives on `listener`, parse the
/// callback query, serve the success page, and return `code`/`state`.
fn accept_one_callback(listener: TcpListener) -> Result<CallbackResult, String> {
    let (mut stream, _addr) = listener.accept().map_err(|e| e.to_string())?;

    // Read just enough to capture the request line. The request line ends at the
    // first CRLF; a small buffer is plenty for a GET with query params.
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let request_line = request.lines().next().unwrap_or("");

    let (code, state) = parse_callback_query(request_line);

    // Always serve the friendly page, even on error, so the browser tab resolves.
    let _ = stream.write_all(success_html().as_bytes());
    let _ = stream.flush();

    let code = code.ok_or_else(|| "OAuth callback missing `code` parameter".to_string())?;
    let state = state.ok_or_else(|| "OAuth callback missing `state` parameter".to_string())?;
    Ok(CallbackResult { code, state })
}

// ---------------------------------------------------------------------------
// Token exchange / refresh
// ---------------------------------------------------------------------------

/// Raw token endpoint response shape (fields we care about).
#[derive(serde::Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    id_token: Option<String>,
    #[serde(default)]
    expires_in: Option<u64>,
}

/// Exchange an authorization `code` for tokens.
async fn exchange_code(
    cfg: &ProviderConfig,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    // application/x-www-form-urlencoded body (NOT json) — provider requirement.
    let form = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("client_id", cfg.client_id),
        ("code_verifier", code_verifier),
    ];
    let resp = client
        .post(cfg.token_url)
        .form(&form)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("token exchange failed: HTTP {status}: {text}"));
    }
    resp.json::<TokenResponse>().await.map_err(|e| e.to_string())
}

/// Use a refresh token to mint a new access token.
async fn refresh_tokens(
    cfg: &ProviderConfig,
    refresh_token: &str,
) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let form = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", cfg.client_id),
    ];
    let resp = client
        .post(cfg.token_url)
        .form(&form)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("token refresh failed: HTTP {status}: {text}"));
    }
    resp.json::<TokenResponse>().await.map_err(|e| e.to_string())
}

/// Turn a [`TokenResponse`] into a persisted [`TokenBundle`], carrying over the
/// previous refresh token / account id when the response omits them (token
/// refresh responses frequently omit `refresh_token` and `id_token`).
fn bundle_from_response(resp: TokenResponse, previous: Option<&TokenBundle>) -> TokenBundle {
    let expires_at_unix = resp
        .expires_in
        .map(|secs| now_unix() + secs)
        .unwrap_or(0);

    // refresh_token: prefer the new one, else keep the previous one.
    let refresh_token = resp
        .refresh_token
        .filter(|t| !t.is_empty())
        .or_else(|| previous.map(|p| p.refresh_token.clone()))
        .unwrap_or_default();

    // account_id: derive from a fresh id_token if present, else keep previous.
    let account_id = resp
        .id_token
        .as_deref()
        .and_then(|jwt| decode_jwt_payload(jwt).ok())
        .map(|payload| extract_chatgpt_account_id(&payload))
        .filter(|id| !id.is_empty())
        .or_else(|| previous.map(|p| p.account_id.clone()))
        .unwrap_or_default();

    TokenBundle {
        access_token: resp.access_token,
        refresh_token,
        expires_at_unix,
        account_id,
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Begin the interactive OAuth flow for `provider`. Binds a loopback listener,
/// opens the system browser at the authorize URL, waits for the redirect, and
/// exchanges the code for tokens, persisting the resulting bundle.
#[tauri::command]
pub async fn oauth_start(provider: String) -> Result<(), String> {
    let cfg = provider_config(&provider)?;

    // 1. Bind the loopback listener (fixed port for openai, random for anthropic).
    let bind_addr = match cfg.fixed_port {
        Some(port) => format!("127.0.0.1:{port}"),
        None => "127.0.0.1:0".to_string(),
    };
    let listener = TcpListener::bind(&bind_addr)
        .map_err(|e| format!("failed to bind loopback {bind_addr}: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    // redirect_uri uses `localhost` (not 127.0.0.1) to match the registered URI.
    let redirect_uri = format!("http://localhost:{port}{}", cfg.redirect_path);

    // 2. PKCE + state.
    let code_verifier = generate_code_verifier();
    let code_challenge = code_challenge_s256(&code_verifier);
    let state = generate_state();

    // 3. Build the authorize URL.
    let url = build_authorize_url(&cfg, &redirect_uri, &state, &code_challenge);

    // 4. Open the browser.
    open::that(&url).map_err(|e| format!("failed to open browser: {e}"))?;

    // 5. Accept one connection on a blocking thread (TcpListener is blocking).
    // Use Tauri's re-exported async runtime so we don't add a direct tokio dep.
    let callback = tauri::async_runtime::spawn_blocking(move || accept_one_callback(listener))
        .await
        .map_err(|e| format!("callback task panicked: {e}"))??;

    // 6. Validate state (CSRF protection).
    if callback.state != state {
        return Err("OAuth state mismatch — aborting (possible CSRF)".to_string());
    }

    // 7. Exchange the code for tokens and persist.
    let token_resp = exchange_code(&cfg, &callback.code, &redirect_uri, &code_verifier).await?;
    let bundle = bundle_from_response(token_resp, None);
    save_bundle(&provider, &bundle)?;

    Ok(())
}

/// Return `true` if a stored OAuth bundle exists for `provider`.
#[tauri::command]
pub fn oauth_status(provider: String) -> bool {
    matches!(load_bundle(&provider), Ok(Some(_)))
}

/// Delete the stored OAuth bundle for `provider` (no-op if absent).
#[tauri::command]
pub fn oauth_logout(provider: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &keychain_account(&provider))
        .map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Return a usable access token for `provider`, refreshing it first if it expires
/// within 60 seconds. The refreshed bundle is persisted back to the keychain.
#[tauri::command]
pub async fn oauth_access_token(provider: String) -> Result<AccessToken, String> {
    let cfg = provider_config(&provider)?;
    let bundle = load_bundle(&provider)?
        .ok_or_else(|| format!("not signed in to {provider}"))?;

    // Refresh when the token expires within 60s. expires_at_unix == 0 means
    // "unknown expiry" — we leave it alone.
    let needs_refresh = bundle_needs_refresh(&bundle, now_unix());

    if needs_refresh {
        if bundle.refresh_token.is_empty() {
            return Err(format!(
                "{provider} access token expired and no refresh token is available — sign in again"
            ));
        }
        let token_resp = refresh_tokens(&cfg, &bundle.refresh_token).await?;
        let refreshed = bundle_from_response(token_resp, Some(&bundle));
        save_bundle(&provider, &refreshed)?;
        return Ok(AccessToken {
            access_token: refreshed.access_token,
            account_id: refreshed.account_id,
        });
    }

    Ok(AccessToken {
        access_token: bundle.access_token,
        account_id: bundle.account_id,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Known-answer test for S256 PKCE from RFC 7636 Appendix B.
    /// verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    /// challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    #[test]
    fn code_challenge_matches_rfc7636_known_vector() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = code_challenge_s256(verifier);
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn verifier_length_within_rfc_range() {
        // base64url-no-pad of 64 bytes => 86 chars, which is within [43, 128].
        for _ in 0..50 {
            let v = generate_code_verifier();
            assert!(
                (43..=128).contains(&v.len()),
                "verifier length {} out of RFC range",
                v.len()
            );
        }
    }

    #[test]
    fn verifier_uses_only_allowed_charset() {
        // RFC 7636 unreserved set; base64url emits a subset: A-Z a-z 0-9 - _ .
        let v = generate_code_verifier();
        for c in v.chars() {
            assert!(
                c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~',
                "verifier contains disallowed char: {c:?}"
            );
        }
    }

    #[test]
    fn verifiers_are_unique() {
        let a = generate_code_verifier();
        let b = generate_code_verifier();
        assert_ne!(a, b, "two generated verifiers should differ");
    }

    #[test]
    fn challenge_is_base64url_nopad_of_32_byte_digest() {
        // sha256 => 32 bytes => base64url-no-pad => 43 chars, no padding.
        let challenge = code_challenge_s256("some-verifier-value");
        assert_eq!(challenge.len(), 43);
        assert!(!challenge.contains('='));
        assert!(!challenge.contains('+'));
        assert!(!challenge.contains('/'));
    }

    #[test]
    fn parse_callback_extracts_code_and_state() {
        let line = "GET /callback?code=abc123&state=xyz789 HTTP/1.1";
        let (code, state) = parse_callback_query(line);
        assert_eq!(code.as_deref(), Some("abc123"));
        assert_eq!(state.as_deref(), Some("xyz789"));
    }

    #[test]
    fn parse_callback_url_decodes_values() {
        let line = "GET /auth/callback?code=a%2Fb%2Bc&state=s%20t HTTP/1.1";
        let (code, state) = parse_callback_query(line);
        assert_eq!(code.as_deref(), Some("a/b+c"));
        assert_eq!(state.as_deref(), Some("s t"));
    }

    #[test]
    fn parse_callback_missing_params_is_none() {
        let line = "GET /callback HTTP/1.1";
        let (code, state) = parse_callback_query(line);
        assert!(code.is_none());
        assert!(state.is_none());
    }

    #[test]
    fn decode_jwt_payload_reads_claims() {
        // {"sub":"123","https://api.openai.com/auth":{"chatgpt_account_id":"acct_42"}}
        // Build a fake unsigned JWT: header.payload.signature (we only read payload).
        let payload_json =
            r#"{"sub":"123","https://api.openai.com/auth":{"chatgpt_account_id":"acct_42"}}"#;
        let payload_b64 = B64_URL_NOPAD.encode(payload_json.as_bytes());
        let jwt = format!("eyJhbGciOiJSUzI1NiJ9.{payload_b64}.sig");

        let payload = decode_jwt_payload(&jwt).expect("payload should decode");
        assert_eq!(payload["sub"], "123");
        let account_id = extract_chatgpt_account_id(&payload);
        assert_eq!(account_id, "acct_42");
    }

    #[test]
    fn extract_account_id_falls_back_to_flat_claim() {
        let payload = serde_json::json!({ "chatgpt_account_id": "flat_acct" });
        assert_eq!(extract_chatgpt_account_id(&payload), "flat_acct");
    }

    #[test]
    fn extract_account_id_empty_when_absent() {
        let payload = serde_json::json!({ "sub": "nobody" });
        assert_eq!(extract_chatgpt_account_id(&payload), "");
    }

    #[test]
    fn provider_config_has_literal_constants() {
        let a = provider_config("anthropic").unwrap();
        assert_eq!(a.client_id, "9d1c250a-e61b-44d9-88ed-5944d1962f5e");
        assert_eq!(a.authorize_url, "https://claude.ai/oauth/authorize");
        assert_eq!(a.token_url, "https://platform.claude.com/v1/oauth/token");
        assert_eq!(a.redirect_path, "/callback");
        assert!(a.fixed_port.is_none());

        let o = provider_config("openai").unwrap();
        assert_eq!(o.client_id, "app_EMoamEEZ73f0CkXaXp7hrann");
        assert_eq!(o.authorize_url, "https://auth.openai.com/oauth/authorize");
        assert_eq!(o.token_url, "https://auth.openai.com/oauth/token");
        assert_eq!(o.redirect_path, "/auth/callback");
        assert_eq!(o.fixed_port, Some(1455));
        assert_eq!(o.extra_authorize_params.len(), 3);

        assert!(provider_config("bogus").is_err());
    }

    #[test]
    fn bundle_refresh_carries_over_missing_fields() {
        let previous = TokenBundle {
            access_token: "old".into(),
            refresh_token: "refresh-1".into(),
            expires_at_unix: 1,
            account_id: "acct_kept".into(),
        };
        // A refresh response that omits refresh_token and id_token.
        let resp = TokenResponse {
            access_token: "new-access".into(),
            refresh_token: None,
            id_token: None,
            expires_in: Some(3600),
        };
        let bundle = bundle_from_response(resp, Some(&previous));
        assert_eq!(bundle.access_token, "new-access");
        assert_eq!(bundle.refresh_token, "refresh-1"); // carried over
        assert_eq!(bundle.account_id, "acct_kept"); // carried over
        assert!(bundle.expires_at_unix > now_unix()); // ~1h in the future
    }

    // -----------------------------------------------------------------------
    // Authorize-URL builder
    // -----------------------------------------------------------------------

    /// Pull the value of a single query param out of a built authorize URL.
    /// Returns the still-percent-encoded value (so we can assert on encoding).
    fn raw_query_param<'a>(url: &'a str, key: &str) -> Option<&'a str> {
        let (_, query) = url.split_once('?')?;
        query.split('&').find_map(|pair| {
            let (k, v) = pair.split_once('=')?;
            (k == key).then_some(v)
        })
    }

    #[test]
    fn authorize_url_anthropic_has_expected_params() {
        let cfg = provider_config("anthropic").unwrap();
        let url = build_authorize_url(
            &cfg,
            "http://localhost:54321/callback",
            "the-state",
            "the-challenge",
        );

        // Base endpoint.
        assert!(url.starts_with("https://claude.ai/oauth/authorize?"));
        // Fixed flow params.
        assert_eq!(raw_query_param(&url, "response_type"), Some("code"));
        assert_eq!(raw_query_param(&url, "code_challenge_method"), Some("S256"));
        // client_id (no special chars => identity-encoded).
        assert_eq!(
            raw_query_param(&url, "client_id"),
            Some("9d1c250a-e61b-44d9-88ed-5944d1962f5e"),
        );
        // redirect_uri is percent-encoded (the registered loopback URI).
        assert_eq!(
            raw_query_param(&url, "redirect_uri"),
            Some("http%3A%2F%2Flocalhost%3A54321%2Fcallback"),
        );
        // scope is space-joined and percent-encoded (spaces => %20).
        assert_eq!(
            raw_query_param(&url, "scope"),
            Some("user%3Aprofile%20user%3Ainference%20user%3Asessions%3Aclaude_code%20user%3Amcp_servers"),
        );
        // PKCE challenge + state echoed through.
        assert_eq!(raw_query_param(&url, "code_challenge"), Some("the-challenge"));
        assert_eq!(raw_query_param(&url, "state"), Some("the-state"));
        // Anthropic has NO extra authorize params.
        assert!(!url.contains("id_token_add_organizations"));
        assert!(!url.contains("originator"));
    }

    #[test]
    fn authorize_url_openai_has_expected_params_and_extras() {
        let cfg = provider_config("openai").unwrap();
        let url = build_authorize_url(
            &cfg,
            "http://localhost:1455/auth/callback",
            "st8",
            "chal",
        );

        assert!(url.starts_with("https://auth.openai.com/oauth/authorize?"));
        assert_eq!(
            raw_query_param(&url, "client_id"),
            Some("app_EMoamEEZ73f0CkXaXp7hrann"),
        );
        assert_eq!(
            raw_query_param(&url, "redirect_uri"),
            Some("http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback"),
        );
        assert_eq!(
            raw_query_param(&url, "scope"),
            Some("openid%20profile%20email%20offline_access"),
        );
        assert_eq!(raw_query_param(&url, "code_challenge_method"), Some("S256"));
        // OpenAI-specific extra authorize params must be present.
        assert_eq!(
            raw_query_param(&url, "id_token_add_organizations"),
            Some("true"),
        );
        assert_eq!(
            raw_query_param(&url, "codex_cli_simplified_flow"),
            Some("true"),
        );
        assert_eq!(raw_query_param(&url, "originator"), Some("trumpcode"));
    }

    // -----------------------------------------------------------------------
    // Token-bundle (de)serialization
    // -----------------------------------------------------------------------

    #[test]
    fn token_bundle_round_trips_through_json() {
        let bundle = TokenBundle {
            access_token: "at".into(),
            refresh_token: "rt".into(),
            expires_at_unix: 1_700_000_000,
            account_id: "acct_1".into(),
        };
        let json = serde_json::to_string(&bundle).unwrap();
        let back: TokenBundle = serde_json::from_str(&json).unwrap();
        assert_eq!(back.access_token, "at");
        assert_eq!(back.refresh_token, "rt");
        assert_eq!(back.expires_at_unix, 1_700_000_000);
        assert_eq!(back.account_id, "acct_1");
    }

    #[test]
    fn token_bundle_deserializes_with_only_access_token() {
        // Optional fields use serde defaults when absent (older/partial bundles).
        let bundle: TokenBundle =
            serde_json::from_str(r#"{"access_token":"only"}"#).unwrap();
        assert_eq!(bundle.access_token, "only");
        assert_eq!(bundle.refresh_token, "");
        assert_eq!(bundle.expires_at_unix, 0);
        assert_eq!(bundle.account_id, "");
    }

    #[test]
    fn token_bundle_missing_access_token_fails() {
        // access_token has no serde default => deserialization must fail.
        let err = serde_json::from_str::<TokenBundle>(r#"{"refresh_token":"x"}"#);
        assert!(err.is_err());
    }

    // -----------------------------------------------------------------------
    // Expiry / refresh-needed decision
    // -----------------------------------------------------------------------

    fn bundle_expiring_at(expires_at_unix: u64) -> TokenBundle {
        TokenBundle {
            access_token: "a".into(),
            refresh_token: "r".into(),
            expires_at_unix,
            account_id: String::new(),
        }
    }

    #[test]
    fn refresh_needed_when_within_sixty_seconds() {
        let now = 1_000_000;
        // Expires exactly at the 60s boundary => refresh (<=).
        assert!(bundle_needs_refresh(&bundle_expiring_at(now + 60), now));
        // Expires in 30s => refresh.
        assert!(bundle_needs_refresh(&bundle_expiring_at(now + 30), now));
        // Already expired => refresh.
        assert!(bundle_needs_refresh(&bundle_expiring_at(now - 1), now));
    }

    #[test]
    fn refresh_not_needed_when_far_in_future() {
        let now = 1_000_000;
        // Expires in 61s => still fresh.
        assert!(!bundle_needs_refresh(&bundle_expiring_at(now + 61), now));
        // Expires in an hour => fresh.
        assert!(!bundle_needs_refresh(&bundle_expiring_at(now + 3600), now));
    }

    #[test]
    fn refresh_not_needed_when_expiry_unknown() {
        // expires_at_unix == 0 means "unknown / never expires" => never refresh.
        let now = u64::MAX - 1;
        assert!(!bundle_needs_refresh(&bundle_expiring_at(0), now));
    }
}
