# Security Policy

## Supported releases

| Version | Security maintenance |
| --- | --- |
| Latest 1.0.x | Supported |
| Earlier releases | Not supported |

Security fixes are evaluated case by case and, when warranted, published as a patch release. This is a community-maintained project with no guaranteed response or remediation SLA.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a suspected security vulnerability.**

Use GitHub's [private vulnerability reporting](https://github.com/alkinbg/UnsavedFormBundle/security/advisories) and select **Report a vulnerability**. Describe affected versions, reproduction steps, impact, and any suggested mitigation. Please avoid disclosing the issue publicly until it has been reviewed.

For non-security bugs, use the [bug report form](https://github.com/alkinbg/UnsavedFormBundle/issues/new/choose).

## Security model and limitations

- The bundle handles form state **in the browser** and does not validate or persist server-side data. Continue to use normal Symfony CSRF protection, authorization, and server-side validation.
- The controller may temporarily retain unsaved values in page memory to survive Turbo restoration. Do **not** mistake this for encrypted storage or a secure draft system.
- It does not send form values to the maintainer or to an external service.
- Browser-native unload dialogs and OS-initiated termination remain under browser/OS control; the application cannot guarantee that a dialog will appear on every platform or termination path.

See the [README](README.md#browserplatform-constraints) for browser-specific behavior.
