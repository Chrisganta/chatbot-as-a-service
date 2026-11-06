(function () {
  var currentScript = document.currentScript;
  if (!currentScript) return;

  // Derive the service's own origin from the script's src, so the widget
  // works correctly no matter what domain it's embedded on.
  var scriptUrl = new URL(currentScript.src);
  var serviceOrigin = scriptUrl.origin;

  var title = currentScript.getAttribute("data-title") || "Chat";
  var position = currentScript.getAttribute("data-position") || "bottom-right";
  var bubbleColor = currentScript.getAttribute("data-color") || "#2563eb";
  var width = currentScript.getAttribute("data-width") || "360px";
  var height = currentScript.getAttribute("data-height") || "520px";
  // Optional: a same-origin URL on the HOST page that returns grounding
  // context (plain text) for the chatbot to answer from. Fetched with the
  // host's own cookies/session, so each host app can scope it however it
  // likes (e.g. per logged-in user) without the chatbot service knowing
  // anything about that app's data model.
  var contextUrl = currentScript.getAttribute("data-context-url");
  var fetchedContext = null;
  // Optional: a pre-assigned access code for this trusted embedding site,
  // so its users never see the chat's "enter access code" gate. Anyone
  // viewing this page's source can see this value — only use it on sites
  // where that's an acceptable trust boundary (e.g. behind the host's own
  // login), not as a secret in itself.
  var accessCode = currentScript.getAttribute("data-access-code") || null;
  // Optional (preferred over data-access-code): a same-origin URL on the
  // HOST's own backend that returns a short-lived session token, e.g.
  // { "token": "..." }. The host's backend fetches that token server-to-
  // server from /api/issue-session using an EMBED_SERVER_KEYS secret that
  // never reaches the browser, then hands it to this endpoint. Unlike
  // data-access-code, the value this widget sees expires — a leaked token
  // is only useful briefly, not forever.
  var sessionUrl = currentScript.getAttribute("data-session-url");
  var sessionToken = null;

  var bubble = document.createElement("button");
  bubble.setAttribute("aria-label", title);
  bubble.textContent = "💬";
  Object.assign(bubble.style, {
    position: "fixed",
    bottom: "20px",
    [position.indexOf("left") >= 0 ? "left" : "right"]: "20px",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: bubbleColor,
    color: "#fff",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    zIndex: 2147483000,
    boxShadow: "0 2px 10px rgba(0,0,0,.2)",
    transition: "transform 0.2s",
  });

  bubble.addEventListener("mouseenter", function () {
    bubble.style.transform = "scale(1.1)";
  });
  bubble.addEventListener("mouseleave", function () {
    bubble.style.transform = "scale(1)";
  });

  var frame = document.createElement("iframe");
  frame.src = serviceOrigin + "/embed?title=" + encodeURIComponent(title);
  frame.setAttribute("allow", "");
  Object.assign(frame.style, {
    position: "fixed",
    bottom: "90px",
    [position.indexOf("left") >= 0 ? "left" : "right"]: "20px",
    width: width,
    height: height,
    border: "none",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,.25)",
    display: "none",
    zIndex: 2147483000,
  });

  var open = false;
  bubble.addEventListener("click", function () {
    open = !open;
    frame.style.display = open ? "block" : "none";
  });

  document.body.appendChild(frame);
  document.body.appendChild(bubble);

  // Relay fetched context, the pre-assigned access code, and/or a fetched
  // session token into the iframe once the context fetch, the session
  // fetch, and the iframe's own load are all done (order between them is
  // not guaranteed). Skipped entirely if there's nothing to send.
  var contextFetchDone = !contextUrl;
  var sessionFetchDone = !sessionUrl;
  function sendContextToFrame() {
    if (!frame.contentWindow) return;
    if (!contextFetchDone || !sessionFetchDone) return;
    if (fetchedContext === null && accessCode === null && sessionToken === null) return;
    frame.contentWindow.postMessage(
      {
        type: "chatbot-context",
        context: fetchedContext,
        accessCode: accessCode,
        sessionToken: sessionToken,
      },
      serviceOrigin
    );
  }

  frame.addEventListener("load", sendContextToFrame);

  if (contextUrl) {
    fetch(contextUrl, { credentials: "include" })
      .then(function (res) {
        return res.ok ? res.text() : null;
      })
      .then(function (text) {
        fetchedContext = text;
        contextFetchDone = true;
        sendContextToFrame();
      })
      .catch(function () {
        // Context is optional — if the host's endpoint is unreachable or
        // errors, just fall back to a plain assistant with no grounding.
        contextFetchDone = true;
        sendContextToFrame();
      });
  }

  function fetchSessionToken() {
    return fetch(sessionUrl, { credentials: "include" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        return data && data.token ? data.token : null;
      })
      .catch(function () {
        return null;
      });
  }

  if (sessionUrl) {
    fetchSessionToken().then(function (token) {
      sessionToken = token;
      sessionFetchDone = true;
      sendContextToFrame();
    });
  }

  if (!contextUrl && !sessionUrl) {
    sendContextToFrame();
  }

  // The iframe tells us (via postMessage) when its session token has
  // expired mid-conversation, so we can fetch a fresh one without the user
  // having to reload the host page.
  window.addEventListener("message", function (e) {
    if (e.source !== frame.contentWindow || e.data?.type !== "chatbot-session-expired") return;
    if (!sessionUrl) return;
    fetchSessionToken().then(function (token) {
      sessionToken = token;
      sendContextToFrame();
    });
  });
})();
