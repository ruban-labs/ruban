appId: {{appId}}
---
# Gongshu demo smoke (ios, era {{era}}). Maestro 2.x syntax.
# Text-based selectors on purpose: RN exposes testID to the automation
# hierarchy inconsistently across eras/architectures (Paper vs Fabric),
# while visible text is stable everywhere. Readouts and buttons carry
# unique bar/circle/pie prefixes in the demo for this reason.
- launchApp:
    clearState: true
- setOrientation: portrait
- extendedWaitUntil:
    visible:
      text: "Gongshu Bench"
    timeout: 60000
- assertVisible:
    text: "era {{era}}"
- assertVisible:
    text: "bar 20%"
- tapOn:
    text: "bar +10%"
- assertVisible:
    text: "bar 30%"
- tapOn:
    text: "bar -10%"
- assertVisible:
    text: "bar 20%"
- scrollUntilVisible:
    element:
      text: "circle +10%"
    direction: DOWN
    timeout: 20000
- assertVisible:
    text: "circle 40%"
- tapOn:
    text: "circle +10%"
- tapOn:
    text: "circle +10%"
- assertVisible:
    text: "circle 60%"
- scrollUntilVisible:
    element:
      text: "pie +10%"
    direction: DOWN
    timeout: 20000
- assertVisible:
    text: "pie 60%"
- tapOn:
    text: "pie -10%"
- assertVisible:
    text: "pie 50%"
- scrollUntilVisible:
    element:
      text: "stop"
    direction: DOWN
    timeout: 20000
- assertVisible:
    text: "CircleSnail"
- tapOn:
    text: "stop"
- tapOn:
    text: "start"
