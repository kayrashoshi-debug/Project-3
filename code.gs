/**
 * Secure Google Apps Script Proxy for Google Gemini API
 * Designed by Music Finders
 */

// Global Configuration
const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Reusable helper to send formatted JSON responses back to the client-side app
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles incoming POST requests from the client-side music application
 */
function doPost(e) {
  try {
    // 1. Securely retrieve the Gemini API Key from your Google Account Script Properties
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    
    if (!apiKey || apiKey.trim() === "") {
      return jsonResponse({ 
        error: "Configuration Error: Script Property 'GEMINI_API_KEY' is missing or blank inside your Apps Script Settings!" 
      });
    }

    // 2. Parse and validate the incoming network payload
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ error: "Invalid Request: No payload or post data found." });
    }

    let postData;
    try {
      postData = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonResponse({ error: "Invalid Request: Malformed JSON payload received." });
    }

    // 3. Assemble and target the Gemini API endpoint
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + DEFAULT_MODEL + ":generateContent?key=" + apiKey;
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(postData),
      muteHttpExceptions: true // Capture error details instead of crashing Apps Script
    };

    // 4. Issue the server-to-server request
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    let json;
    try {
      json = JSON.parse(responseText);
    } catch (e) {
      return jsonResponse({ error: "Gemini returned a non-JSON response. HTTP Status: " + responseCode });
    }

    // 5. Check if the upstream request failed
    if (responseCode !== 200) {
      const errMsg = json.error && json.error.message ? json.error.message : "HTTP Status " + responseCode;
      return jsonResponse({ error: "Gemini API Error: " + errMsg });
    }

    // 6. Safe deep property resolution (prevents crashes if Gemini structure changes)
    const candidates = json.candidates;
    if (!candidates || candidates.length === 0) {
      return jsonResponse({ error: "Gemini API Error: No response candidates returned." });
    }

    const firstCandidate = candidates[0];
    const contentParts = firstCandidate.content && firstCandidate.content.parts;
    if (!contentParts || contentParts.length === 0) {
      return jsonResponse({ error: "Gemini API Error: Response content parts are empty." });
    }

    const generatedText = contentParts[0].text;
    if (!generatedText) {
      return jsonResponse({ error: "Gemini API Error: Generated text part is blank." });
    }

    // Success response
    return jsonResponse({ responseText: generatedText });

  } catch (err) {
    // Catch-all safety net
    return jsonResponse({ error: "Internal Proxy Error: " + err.toString() });
  }
}

/**
 * Handles incoming GET requests (allows painless browser URL testing)
 */
function doGet(e) {
  return jsonResponse({
    status: "online",
    message: "Your secure Gemini music proxy is live! Route your music player queries through this deployment URL.",
    timestamp: new Date().toISOString()
  });
}
