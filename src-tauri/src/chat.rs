use futures_util::StreamExt;
use std::collections::HashMap;
use tauri::ipc::Channel;

#[derive(serde::Deserialize)]
pub struct ChatArgs {
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: serde_json::Value,
}

/// Make a native (CORS-free) streaming HTTP request to a provider and push raw
/// response chunks back to the webview over a Channel. The frontend buffers and
/// parses the SSE itself.
#[tauri::command]
pub async fn chat_stream(args: ChatArgs, on_event: Channel<String>) -> Result<(), String> {
    let client = reqwest::Client::new();
    let mut req = client.post(&args.url).json(&args.body);
    for (k, v) in args.headers {
        req = req.header(k, v);
    }

    eprintln!("[chat] request url: {}", args.url);
    let resp = req.send().await.map_err(|e| e.to_string())?;
    eprintln!("[chat] response status: {}", resp.status());
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        eprintln!("[chat] request FAILED: status={status} body={text}");
        return Err(format!("HTTP {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        on_event
            .send(String::from_utf8_lossy(&bytes).to_string())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
