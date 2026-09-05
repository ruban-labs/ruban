appId: {{appId}}
---
# Cold-launch phase for the latest iOS app. The CI harness follows this with a
# system-level custom-scheme open before running the Settings interaction flow.
- launchApp:
    clearState: true
- setOrientation: portrait
{{initialAssertions}}
