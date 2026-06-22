/* CC Blocker — BCC Reminder for Gmail
 *
 * Warns when a Gmail message CCs more than THRESHOLD recipients and suggests
 * BCC instead. It counts the recipient chips inside the compose window's CC
 * region, scoped to the compose being sent so stale chips from other composes
 * are never counted.
 */
(function () {
  "use strict";

  // Warn when the CC field has this many recipients or more.
  // Strictly MORE than THRESHOLD triggers the warning, so 2 fires at 3+.
  const THRESHOLD = 2;

  // When true, our own programmatic Send click is allowed straight through.
  let bypass = false;

  /* ---------- recipient counting ----------
   *
   * Gmail has no hidden <textarea name="cc">. Each recipient field is an
   * <input> identified by aria-label ("To recipients" / "CC recipients" /
   * "BCC recipients"); chosen recipients are chips carrying the address in an
   * [email] / [data-hovercard-id] attribute. The input's value is only the
   * text being typed, so we count chips, scoped to one compose to avoid the
   * stale chips that closed/minimized composes leave behind in the DOM.
   * NOTE: aria-labels are English; other UI languages need their localized
   * equivalents added to the regexes below.
   */

  const TO_RE = /^to\b/i;
  const CC_RE = /^cc\b/i;
  const BCC_RE = /^bcc\b/i;

  function recipientInput(scope, re) {
    const inputs = scope.querySelectorAll("input[aria-label]");
    for (const input of inputs) {
      if (re.test((input.getAttribute("aria-label") || "").trim())) return input;
    }
    return null;
  }

  // Walk up from an element to the smallest ancestor that holds the To field —
  // that ancestor is the compose window, and it also holds the Send button.
  function getComposeRoot(fromEl) {
    let el = fromEl;
    while (el && el !== document.body) {
      if (el.querySelector && recipientInput(el, TO_RE)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // The CC region is the largest ancestor of the CC input that does NOT also
  // contain the To or BCC inputs — i.e. just the CC field and its chips.
  function getCcRegion(root) {
    const ccInput = recipientInput(root, CC_RE);
    if (!ccInput) return null;
    const toInput = recipientInput(root, TO_RE);
    const bccInput = recipientInput(root, BCC_RE);

    let region = ccInput.parentElement;
    let el = ccInput.parentElement;
    while (el && el !== root) {
      if ((toInput && el.contains(toInput)) || (bccInput && el.contains(bccInput))) break;
      region = el;
      el = el.parentElement;
    }
    return region;
  }

  // Count unique email addresses among the chips in the CC region. A single
  // chip may expose its address on more than one node, so dedupe by address.
  function countCc(root) {
    const region = getCcRegion(root);
    if (!region) return 0;
    const emails = new Set();
    region.querySelectorAll("[email],[data-hovercard-id]").forEach(function (n) {
      const e = (n.getAttribute("email") || n.getAttribute("data-hovercard-id") || "")
        .trim()
        .toLowerCase();
      if (e) emails.add(e);
    });
    return emails.size;
  }

  /* ---------- send button detection ---------- */

  function isSendButton(btn) {
    if (!btn) return false;
    const label = (
      btn.getAttribute("aria-label") ||
      btn.getAttribute("data-tooltip") ||
      ""
    ).trim();
    // Matches "Send", "Send ‪(Ctrl-Enter)‬", "Send & Archive", etc.
    if (/^Send\b/i.test(label)) return true;
    return btn.getAttribute("role") === "button" && btn.textContent.trim() === "Send";
  }

  function findSendButton(root) {
    if (!root) return null;
    const buttons = root.querySelectorAll('[role="button"]');
    for (const btn of buttons) {
      if (isSendButton(btn)) return btn;
    }
    return null;
  }

  /* ---------- warning modal ---------- */

  function proceedSend(root) {
    const btn = findSendButton(root);
    if (!btn) return;
    bypass = true;
    btn.click();
    // Reset on the next tick, after the synthetic click has propagated.
    setTimeout(() => {
      bypass = false;
    }, 0);
  }

  function closeModal() {
    const existing = document.getElementById("cc-blocker-overlay");
    if (existing) existing.remove();
  }

  function showWarning(count, root) {
    closeModal();

    const overlay = document.createElement("div");
    overlay.id = "cc-blocker-overlay";
    overlay.className = "cc-blocker-overlay";

    const modal = document.createElement("div");
    modal.className = "cc-blocker-modal";
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "cc-blocker-title";
    title.textContent = "⚠️ That's a lot of people in CC";

    const body = document.createElement("p");
    body.className = "cc-blocker-body";
    body.innerHTML =
      "You're about to <strong>CC " +
      count +
      " people</strong>. Everyone in CC can see each other's email addresses." +
      "<br><br>Consider using <strong>BCC</strong> instead to keep their addresses private and avoid reply-all storms.";

    const actions = document.createElement("div");
    actions.className = "cc-blocker-actions";

    const reviewBtn = document.createElement("button");
    reviewBtn.className = "cc-blocker-btn cc-blocker-btn-primary";
    reviewBtn.textContent = "Review recipients";
    reviewBtn.addEventListener("click", closeModal);

    const sendBtn = document.createElement("button");
    sendBtn.className = "cc-blocker-btn cc-blocker-btn-secondary";
    sendBtn.textContent = "Send anyway";
    sendBtn.addEventListener("click", function () {
      closeModal();
      proceedSend(root);
    });

    actions.appendChild(reviewBtn);
    actions.appendChild(sendBtn);
    modal.appendChild(title);
    modal.appendChild(body);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", escHandler, true);
      }
    }, true);

    document.body.appendChild(overlay);
    reviewBtn.focus();
  }

  /* ---------- intercept send attempts ---------- */

  function maybeBlock(triggerEl, e) {
    const root = getComposeRoot(triggerEl);
    if (!root) return;
    const count = countCc(root);
    if (count > THRESHOLD) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showWarning(count, root);
    }
  }

  // Click on the Send button.
  document.addEventListener(
    "click",
    function (e) {
      if (bypass) return;
      const btn = e.target.closest && e.target.closest('[role="button"]');
      if (!btn || !isSendButton(btn)) return;
      maybeBlock(btn, e);
    },
    true
  );

  // Keyboard shortcut: Ctrl/⌘ + Enter.
  document.addEventListener(
    "keydown",
    function (e) {
      if (bypass) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        maybeBlock(document.activeElement, e);
      }
    },
    true
  );

  /* ---------- live in-compose banner ---------- */

  function updateBanners() {
    document.querySelectorAll("input[aria-label]").forEach(function (input) {
      if (!CC_RE.test((input.getAttribute("aria-label") || "").trim())) return;
      if (!input.offsetParent) return; // skip hidden / stale composes

      const root = getComposeRoot(input);
      if (!root) return;
      const host = input.closest('[role="dialog"]') || root;

      let banner = host.querySelector(":scope > .cc-blocker-banner");
      const count = countCc(root);

      if (count > THRESHOLD) {
        if (!banner) {
          banner = document.createElement("div");
          banner.className = "cc-blocker-banner";
          host.insertBefore(banner, host.firstChild);
        }
        banner.textContent =
          "⚠️ " + count + " people in CC — consider using BCC to keep their addresses private.";
      } else if (banner) {
        banner.remove();
      }
    });
  }

  setInterval(updateBanners, 800);
})();
