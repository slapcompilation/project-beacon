<!-- source: https://palantir.com/docs/foundry/getting-started/authentication/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Authentication

There are two options for authentication on the Palantir platform. Enrollment administrators can integrate an existing identity provider, or you can use Palantir’s self-service passwordless identity provider for AIP Developer Tier and AIP Bootcamp enrollments.

[Learn more about logging in to a Palantir enrollment.](/docs/foundry/getting-started/login/)

## Your own identity provider

The Palantir platform can integrate seamlessly with your existing identity provider, allowing full end-to-end access administration and management through your existing system. Review the [administration documentation](/docs/foundry/authentication/overview/) for detailed instructions on how to configure your identity provider for use with the Palantir platform.

## Palantir self-service user directory

In some scenarios, your enrollment may be automatically configured with a built-in identity provider. Palantir's self-service user directory is **passwordless**, leveraging FIDO2 passkeys to offer unparalleled security and a seamless user experience.

If you signed up for a new enrollment with the Palantir self-service user directory, you will receive an email with the subject "Set up your Palantir account and log in" shortly after signing up. After [completing the instructions to set up your account](/docs/foundry/getting-started/login/#set-up-and-configure-a-passkey), you can invite additional users to your enrollment in Control Panel by navigating to **Authentication > Palantir self-service user directory**. Then, select **Manage users**.

We recommend that you configure more than one [enrollment administrator](/docs/foundry/administration/enrollments-and-organizations-permissions/) to assist with account recovery as a backup.

### What are passkeys?

FIDO2 (Fast IDentity Online) passkeys are a passwordless login method that use cryptography and a device's built-in security features, such as facial recognition, to verify your identity. A passkey is not the same as a password, and you do not need to remember it or enter it into a login form. Instead, your device will verify your identity using security features such as biometrics, and provide a private cryptographic key to authenticate you, allowing you to log in. Passkeys eliminate the need to remember complex passwords and allow you to sign in with your fingerprint, face scan, security key, or password manager.

### How do passkeys work?

A FIDO2 passkey is a physical security key or a platform authenticator, such as a biometric device or a smartphone, that can be used for passwordless authentication. Devices such as smartphones generate a unique pair of public and private keys for each service or application. The public key is registered with the service, and the private key remains securely stored on the device.

When you use a FIDO2 passkey for authentication, the service will send a challenge to your device. The device will sign the challenge using the private key and send the signed response back to the service. The service then verifies the response using the public key to confirm your identity.

Passkeys provide several benefits:

* **Strong security:** Public-key cryptography provides a high level of security, and since the private key never leaves the device, it is less vulnerable to attacks.
* **Passwordless authentication:** FIDO2 passkeys eliminate the need for passwords, making authentication more convenient and reducing the risk of phishing and other password-related attacks.
* **Privacy:** The unique key pairs generated for each service ensure that your authentication information cannot be used to track your activities across different services.
* **Ease of use:** Passkeys provide a simple, user-friendly authentication experience that requires only a single action, such as inserting the security key or using a biometric device such as a fingerprint or face scan.

For detailed instructions on logging in with a passkey, review the [login documentation](/docs/foundry/getting-started/login/).
