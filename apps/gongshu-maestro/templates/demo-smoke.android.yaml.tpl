appId: {{appId}}
---
# Gongshu app-shell smoke (android, era {{era}}). Maestro 2.x syntax.
# Text-based selectors on purpose: RN exposes testID to the automation
# hierarchy inconsistently across eras/architectures (Paper vs Fabric),
# while visible product labels are stable everywhere.
- launchApp:
    clearState: true
- setOrientation: portrait
- extendedWaitUntil:
    visible:
      text: "Components"
    timeout: 60000
- assertVisible:
    text: "Button"
- assertVisible:
    text: "Playground"
- tapOn:
    text: "Button"
- extendedWaitUntil:
    visible:
      text: "← COMPONENTS"
    timeout: 20000
- assertNotVisible:
    text: "Playground"
- assertNotVisible:
    text: "Settings"
- tapOn:
    text: "← COMPONENTS"
- extendedWaitUntil:
    visible:
      text: "Components"
    timeout: 20000
- openLink: "{{scheme}}://components/badge?theme=light&variant=live&size=md"
- extendedWaitUntil:
    visible:
      text: "Badge"
    timeout: 20000
- assertVisible:
    text: "LIVE"
- openLink: "{{scheme}}://components/separator?theme=dark&orientation=vertical&tone=accent&weight=bold"
- extendedWaitUntil:
    visible:
      text: "Separator"
    timeout: 20000
- assertVisible:
    text: "VERTICAL"
- assertVisible:
    text: "Live separator vertical accent bold"
- openLink: "{{scheme}}://components/switch?theme=light&state=on&size=md"
- extendedWaitUntil:
    visible:
      text: "Switch"
    timeout: 20000
- assertVisible:
    text: "CONTROL"
- assertVisible:
    text: "Live switch state ON"
- tapOn:
    text: "Live switch"
- assertVisible:
    text: "Live switch state OFF"
- openLink: "{{scheme}}://home"
- extendedWaitUntil:
    visible:
      text: "Components"
    timeout: 20000
- tapOn:
    text: "Playground"
- extendedWaitUntil:
    visible:
      text: "PLAYGROUND"
    timeout: 20000
- assertVisible:
    text: "LIGHT"
- assertVisible:
    text: "TYPE"
- tapOn:
    text: "Settings"
- extendedWaitUntil:
    visible:
      text: "Settings"
    timeout: 20000
- assertVisible:
    text: "Appearance"
- scrollUntilVisible:
    element:
      text: "Build & matrix"
    direction: DOWN
    timeout: 20000
- tapOn:
    text: "Build & matrix"
- extendedWaitUntil:
    visible:
      text: "Build & Matrix"
    timeout: 20000
- assertVisible:
    text: "HERMES"
- tapOn:
    text: "CLOSE"
- extendedWaitUntil:
    visible:
      text: "Settings"
    timeout: 20000
