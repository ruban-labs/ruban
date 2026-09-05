appId: {{appId}}
---
# The iOS 18 simulator does not reliably relaunch a stopped app through
# Maestro's custom-scheme openLink action. Deep links remain covered by the
# Android latest flow and both older iOS flows; this flow validates the latest
# app through the same user-visible in-app navigation paths.
- launchApp:
    clearState: true
- setOrientation: portrait
{{initialAssertions}}
- tapOn:
    text: "Settings"
- extendedWaitUntil:
    visible:
      text: "Settings"
    timeout: 20000
- scrollUntilVisible:
    element:
      text: "Playground.*"
    direction: DOWN
    timeout: 20000
- tapOn:
    text: "Playground.*"
- extendedWaitUntil:
    visible:
      text: "COMPONENTS"
    timeout: 20000
- tapOn:
    text: "Button"
- extendedWaitUntil:
    visible:
      text: "Button"
    timeout: 20000
- assertVisible:
    text: "RUN ACTION"
- assertNotVisible:
    text: "Playground"
- assertNotVisible:
    text: "Settings"
- tapOn:
    text: "Back to components"
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
