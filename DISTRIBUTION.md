# Professional Distribution

SendOnce Mails is configured for professional macOS and Windows distribution. The project can build installers now, but trusted distribution requires private signing credentials that must come from the app owner.

## macOS

Professional macOS distribution requires:

- Apple Developer Program membership.
- A `Developer ID Application` certificate.
- Apple notarization credentials.

Electron Builder will sign automatically when a valid certificate is available in Keychain or when certificate environment variables are provided.

Common environment variables:

```bash
export CSC_LINK="/absolute/path/to/developer-id-application.p12"
export CSC_KEY_PASSWORD="certificate-password"
export APPLE_ID="apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID12345"
```

Then build:

```bash
npm run dist:mac:professional
```

Output is written to `release/`, including a `.dmg` installer for users.

If the certificate is already installed in Keychain, you may not need `CSC_LINK` or `CSC_KEY_PASSWORD`.

## Windows

Professional Windows distribution requires:

- A code-signing certificate from a trusted certificate authority.
- For the best first-run trust, an EV code-signing certificate is preferred.

For a standard exportable certificate:

```powershell
$env:WIN_CSC_LINK="C:\path\to\windows-code-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD="certificate-password"
npm run dist:win:professional
```

For an EV certificate on a hardware token, install the certificate tools on the Windows build laptop and add the certificate subject name to the `win.certificateSubjectName` setting in `package.json`.

Output is written to `release/`, including `SendOnce Mails Setup <version>.exe`.

## Important

Do not commit certificates, passwords, Apple credentials, or `.p12` / `.pfx` files to the project.

Professional release builds should be created on the matching operating system:

- Build macOS releases on macOS.
- Build Windows releases on Windows.

Cross-building can work for unpacked testing, but native signing and final installer trust are more reliable on the target platform.
