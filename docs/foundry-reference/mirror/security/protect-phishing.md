<!-- source: https://palantir.com/docs/foundry/security/protect-phishing/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Protecting against phishing

Phishing is the most common attack vector used by adversaries when attempting to compromise technical infrastructure. If an attacker successfully used a phishing attack to take over or steal credentials from a Foundry customer’s SSO account, they’d likely try using those credentials to access the Foundry platform. Palantir has engineered several controls to assist in mitigating potential security impact from phishing attacks. However, in the spirit of maintaining a [shared security model](/docs/foundry/security/shared-security-responsibility-model/), Palantir also advises that customers observe several best practices in an effort to harden their own attack surface against phishing.

## Multi-factor authentication (MFA)

Foundry customers are responsible for managing access and identity for users via single sign-on (SSO). One of the most impactful controls in securing the authentication workflow is enforcement of multi-factor authentication (MFA). Ensuring that all users are enrolled in MFA means that an attacker would need to defeat multiple security controls to inappropriately access the Foundry platform.

## Ingress Controls

Palantir natively supports ingress controls, as described in the [Configure network ingress documentation](/docs/foundry/administration/configure-ingress/). Palantir recommends strict IP allowlisting as a defense-in-depth control intended to deny adversaries the network access required to take offensive action.

Additionally, any ingress controls on the Foundry side can be mirrored in one’s SSO controls for redundancy.

## Conditional Access

If using Microsoft Azure AD (or an IdP with similar features), consider leveraging [conditional access policies ↗](https://docs.microsoft.com/en-us/azure/active-directory/conditional-access/overview) to further enforce access to Foundry. Even in cases where IP ingress restrictions are untenable, there may still be security value in restricting access based on other factors, such as enrollment in device management.

## Single Sign-On (SSO)

If implementing a single sign-on (SSO) solution with appropriate security controls is infeasible for any customer, contact your Palantir representative; we may be able to provide one for you.

## Operational Security

Humans are generally the key point-of-failure in successful phishing attacks, and proper OpSec training is key to ensuring that users do not fall victim. Some key points to cover with personnel include:

* Password hygiene and management.
* Recognizing legitimate web domains (such as palantirfoundry.com) vs. fraudulent sites operated by adversaries.
* Recognizing legitimate emails from the Foundry platform vs. emails from fraudulent senders.

## Ask a Trusted Source

If you are in need of engineering assistance, or general security guidance, contact your Palantir representative; we are happy to assist with controls to mitigate against attacker activity.
