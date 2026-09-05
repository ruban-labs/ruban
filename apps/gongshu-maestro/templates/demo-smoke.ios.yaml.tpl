appId: {{appId}}
---
# Gongshu app-shell smoke (ios, era {{era}}). Maestro 2.x syntax.
# Text-based selectors on purpose: RN exposes testID to the automation
# hierarchy inconsistently across eras/architectures (Paper vs Fabric).
# User-facing copy and explicit accessibility labels form the stable contract.
- launchApp:
    clearState: true
- setOrientation: portrait
{{initialAssertions}}
{{openButtonShowcase}}
- extendedWaitUntil:
    visible:
      text: "Back to components"
    timeout: 20000
- assertNotVisible:
    text: "Playground"
- assertNotVisible:
    text: "Settings"
{{afterButtonShowcase}}
{{openBadgeShowcase}}
- extendedWaitUntil:
    visible:
      text: "Back to components"
    timeout: 120000
- assertVisible:
    text: "LIVE"
{{openSeparatorShowcase}}
- extendedWaitUntil:
    visible:
      text: "Live separator vertical accent bold"
    timeout: 60000
- assertVisible:
    text: "VERTICAL"
- assertVisible:
    text: "Live separator vertical accent bold"
{{openSwitchShowcase}}
- extendedWaitUntil:
    visible:
      text: "Live switch state ON"
    timeout: 60000
- assertVisible:
    text: "CONTROL"
- assertVisible:
    text: "Live switch state ON"
- tapOn:
    text: "Live switch"
- assertVisible:
    text: "Live switch state OFF"
{{openSequentialDialogShowcase}}
- extendedWaitUntil:
    visible:
      text: "FIRST DIALOG"
    timeout: 60000
- tapOn:
    text: "NEXT DIALOG"
- extendedWaitUntil:
    visible:
      text: "SECOND DIALOG"
    timeout: 60000
- assertNotVisible:
    text: "FIRST DIALOG"
- tapOn:
    text: "DONE"
{{openNestedDialogShowcase}}
- extendedWaitUntil:
    visible:
      text: "PARENT DIALOG"
    timeout: 60000
- tapOn:
    text: "OPEN CONFIRMATION"
- extendedWaitUntil:
    visible:
      text: "CONFIRM ACTION"
    timeout: 60000
- tapOn:
    text: "RETURN TO PARENT"
- extendedWaitUntil:
    visible:
      text: "PARENT DIALOG"
    timeout: 60000
- tapOn:
    text: "CLOSE"
{{openExternalDialogShowcase}}
- extendedWaitUntil:
    visible:
      text: "RELEASE GATE"
    timeout: 60000
- assertNotVisible:
    text: "GATED DIALOG"
- tapOn:
    text: "RELEASE GATE"
- extendedWaitUntil:
    visible:
      text: "GATED DIALOG"
    timeout: 60000
- tapOn:
    text: "DONE"
{{openPlayground}}
- extendedWaitUntil:
    visible:
      text: "PLAYGROUND"
    timeout: 20000
- assertVisible:
    text: "LIGHT"
- assertVisible:
    text: "TYPE"
{{openSettings}}
- extendedWaitUntil:
    visible:
      text: "Settings"
    timeout: 20000
- assertVisible:
    text: "Appearance.*"
- tapOn:
    text: "Appearance.*"
- extendedWaitUntil:
    visible:
      text: "System"
    timeout: 20000
- assertVisible:
    text: "Light"
- assertVisible:
    text: "Dark"
- tapOn:
    text: "Light"
- extendedWaitUntil:
    visible:
      text: "Settings"
    timeout: 20000
- scrollUntilVisible:
    element:
      text: "{{settingsBuildEntry}}.*"
    direction: DOWN
    timeout: 20000
- tapOn:
    text: "{{settingsBuildEntry}}.*"
- extendedWaitUntil:
    visible:
      text: "{{settingsBuildTitle}}"
    timeout: 20000
- assertVisible:
    text: "HERMES"
- tapOn:
    text: "CLOSE"
- extendedWaitUntil:
    visible:
      text: "Settings"
    timeout: 20000
