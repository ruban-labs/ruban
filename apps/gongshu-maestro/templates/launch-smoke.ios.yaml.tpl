appId: {{appId}}
---
# Cold-launch phase for iOS. The CI harness follows this with a system-level
# custom-scheme open and a separate permission-handshake flow.
- launchApp:
    clearState: true
- setOrientation: portrait
{{initialAssertions}}
