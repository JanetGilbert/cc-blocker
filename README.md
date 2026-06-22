Vibe coded with Claude

# CC Blocker — BCC Reminder for Gmail

A Chrome extension that warns you when you CC **3 or more people** in Gmail and
suggests using **BCC** instead — keeping everyone's email address private and
avoiding accidental reply-all storms.

## What it does

- **Live banner** inside the compose window once CC has more than 5 recipients.
- **Pop-up warning** when you hit **Send** (button or `Ctrl`/`⌘ + Enter`) with too
  many people in CC, offering:
  - **Review recipients** — closes the warning so you can move people to BCC.
  - **Send anyway** — sends the message unchanged.

It counts recipients by reading Gmail's hidden `cc` field, which stays in sync
with the visible recipient chips.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (`cc-blocker`).
4. Open Gmail and compose a message — add 6+ people to CC to see it in action.

After editing any file, return to `chrome://extensions` and click the reload
icon on the extension card.

## Configuration

Change the threshold by editing `THRESHOLD` near the top of `content.js`. The
warning triggers when CC has *more than* `THRESHOLD` recipients, so the default
`2` fires at 3 or more.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (Manifest V3) |
| `content.js` | Counts CC recipients, shows banner + warning, intercepts Send |
| `styles.css` | Styling for the banner and modal |
| `icons/` | Extension icons (16/48/128 px) |
