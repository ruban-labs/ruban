appId: {{appId}}
---
# The iOS 18 simulator does not reliably relaunch a stopped app through
# Maestro custom-scheme action or deliver taps to the custom icon-only tab.
# The CI harness cold-launches the app, accepts the first-use scheme prompt in
# a separate flow, then opens ruban-debug://settings again before this flow.
- extendedWaitUntil:
    visible:
      text: "Appearance.*"
    timeout: 20000
- scrollUntilVisible:
    element:
      id: "settings-playground"
    direction: DOWN
    timeout: 20000
- tapOn:
    id: "settings-playground"
- extendedWaitUntil:
    visible:
      text: "COMPONENTS"
    timeout: 20000
- tapOn:
    id: "playground-open-button"
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
      text: "Appearance.*"
    timeout: 20000
- scrollUntilVisible:
    element:
      id: "settings-build"
    direction: DOWN
    timeout: 20000
- tapOn:
    id: "settings-build"
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
      text: "Appearance.*"
    timeout: 20000
