# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]: ——— ———
    - button "Toggle Unit" [ref=e4] [cursor=pointer]: mph
  - generic:
    - generic [ref=e5]:
      - generic [ref=e6]: Stay Awake
      - checkbox "Stay Awake" [ref=e7]
    - generic: Location permission denied. Enable it to see speed.
    - generic [ref=e8]:
      - button "Show info" [ref=e9] [cursor=pointer]:
        - img [ref=e10]
      - link "View source on GitHub" [ref=e12] [cursor=pointer]:
        - /url: https://github.com/samuel-skean/speedometer
        - img [ref=e13]
  - generic:
    - heading "Heads up!" [level=2]
    - paragraph: This app was mostly vibecoded, and the speed can drop out, though the app should tell you if the speed is more than 5 seconds out of date.
    - paragraph: Also, the app requires location permissions. Your location + speed data never leave your device.
    - generic:
      - button "Got it"
```