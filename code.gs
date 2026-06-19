/**
 * Music Finders — Google Apps Script backend
 *
 * This project holds BOTH the web page (index.html) and this server code in
 * the SAME Apps Script project, so:
 *   - doGet() serves the index.html page (HtmlService).
 *   - the page calls askGemini() directly via google.script.run — no fetch,
 *     no CORS, and the API key never reaches the browser.
 *
 * The Gemini API key lives in the Script Property GEMINI_API_KEY
 * (Project Settings -> Script Properties). It is never exposed to the client.
 */

// Global Configuration
// Flash is fast and has generous free-tier limits — a good fit for a live class.
// For higher-quality (slower) recommendations you can switch to "gemini-2.5-pro".
const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Serves the single-page web app. Opening the Web App /exec URL in a browser
 * runs this and returns the index.html page (NOT a JSON status).
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
                    .setTitle('The Universe of Music Finder')
                    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
                    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Called from the client via google.script.run.askGemini(payload).
 *
 * @param {Object} payload  { contents: [...], systemInstruction: {...} }
 * @return {string} The generated text. Throws on any error, which the client
 *                  receives in its withFailureHandler.
 */
function askGemini(payload) {
  // 1. Securely retrieve the Gemini API key from Script Properties.
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Script Property 'GEMINI_API_KEY' is missing or blank. Add it in Project Settings -> Script Properties.");
  }

  // 2. Validate the incoming payload.
  if (!payload || !payload.contents) {
    throw new Error("Invalid request: payload has no 'contents'.");
  }

  // 3. Call the Gemini API (server-to-server).
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + DEFAULT_MODEL + ":generateContent?key=" + apiKey;
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // capture error details instead of crashing
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  // 4. Parse and validate the upstream response.
  let json;
  try {
    json = JSON.parse(responseText);
  } catch (err) {
    throw new Error("Gemini returned a non-JSON response (HTTP " + responseCode + ").");
  }

  if (responseCode !== 200) {
    const errMsg = (json.error && json.error.message) ? json.error.message : ("HTTP Status " + responseCode);
    throw new Error("Gemini API error: " + errMsg);
  }

  // 5. Safe deep property resolution.
  const candidates = json.candidates;
  const parts = candidates && candidates[0] && candidates[0].content && candidates[0].content.parts;
  const generatedText = parts && parts[0] && parts[0].text;
  if (!generatedText) {
    throw new Error("Gemini returned no text (it may have been blocked by a safety filter).");
  }

  return generatedText;
}
