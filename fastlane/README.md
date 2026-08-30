fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios sync_signing

```sh
[bundle exec] fastlane ios sync_signing
```

Create or refresh every Ruban development, Ad Hoc, and App Store signing profile

### ios ensure_app_store_record

```sh
[bundle exec] fastlane ios ensure_app_store_record
```

Verify that the manually created Ruban App Store Connect record exists

### ios upload_testflight

```sh
[bundle exec] fastlane ios upload_testflight
```

Upload an App Store-signed IPA to TestFlight

----


## Android

### android validate_google_play

```sh
[bundle exec] fastlane android validate_google_play
```

Verify the Google Play service account

### android upload_internal

```sh
[bundle exec] fastlane android upload_internal
```

Upload a Play-signed AAB as a draft internal release

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
