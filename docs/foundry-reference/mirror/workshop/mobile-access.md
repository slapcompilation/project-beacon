<!-- source: https://palantir.com/docs/foundry/workshop/mobile-access/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Network access and authentication

Mobile applications developed in Workshop are simply web applications that have been optimized for use in mobile browsers. As a result, there is no installation step required for users to access these web applications on their tablet or phone devices. However, it is necessary to ensure your users' devices can access your Foundry environment at a network level, and that your users can successfully authenticate to Foundry.

This page describes how you should think about network access and authentication, common problems you may encounter, and possible solutions to these problems. You may need to work with your IT counterparts to debug and fix any issues, especially those related to network access.

At a high level, ensuring access for your users can be broken down into two main components which are described below:

* [Ensure network access](#ensure-network-access)
* [Ensure users can authenticate](#ensure-users-can-authenticate)

## Ensure network access

As Foundry can be deployed in a wide variety of settings, ranging from Palantir's managed SaaS environment to on-premise configurations, there is no single solution for ensuring users have access to Foundry from their mobile devices. In this section, we present a range of options for enabling access for your users.

The most common approaches to enabling mobile access to Foundry are to:

* [Use an enterprise web browser](#use-an-enterprise-web-browser)
* [Use a mobile VPN](#use-a-mobile-vpn)
* [Allowlist an IP region](#allowlist-an-ip-region)

### Use an enterprise web browser

Many organizations have an MDM (Mobile Device Management) solution in place for managing mobile devices, and most MDM solutions include a secure web browser that can be used to access internal company resources. If your organization has an MDM set up, it may be possible to use the MDM-supported browser to access Foundry.

The main downside to this approach is that the MDM-supported web browser may render web components differently than a standard browser such as Safari, Chrome, or Edge. As a result, user experience may be worse compared to commonly used browsers. Additionally, any users who do not have a device managed by your organization will not be able to access Foundry.

If you know your user base already has devices managed by an organizational MDM, using the MDM-supported web browser is likely the most direct and secure path forward.

**Next step:** Contact your IT organization to learn about whether there is an existing enterprise MDM in place, and whether the MDM's web browser can be configured to enable access to your Foundry environment.

### Use a mobile VPN

Your organization may support a VPN to enable employees to access corporate resources while away from an office location. Many VPN solutions include support for access on mobile devices as well, enabling users to connect to the VPN and then access internal resources using their device's standard web browser.

The main benefit to this approach is that users can use a standard browser such as Safari or Chrome. The downside is that users will need to go through an additional step of connecting to the VPN each time they use Foundry, in addition to initially setting up the VPN client. If your users are accustomed to this workflow, this may not be an issue, but it could pose problems for rolling out an application to a set of users who have not previously used mobile VPNs.

**Next step:** Contact your IT organization to learn about whether there is a mobile VPN client available. If so, validate that your users have access to the VPN and that using the VPN will enable access to your Foundry environment.

### Allowlist an IP region

By [configuring network ingress in Control Panel](/docs/foundry/administration/configure-ingress/), you can choose to allow broad network access from certain countries from which your users operate.

The benefit to this approach is that users in the allowlisted regions can access your Foundry environment from any device without an MDM-managed device or a VPN client (if you were previously using strict IP-based allowlisting). This method provides a more seamless login experience for users. However, your organization may not be comfortable allowing network ingress into your Foundry environment from a broader set of networks.

## Ensure users can authenticate

Once your users can access Foundry at a network level, they will need to navigate to the [mobile application launcher](/docs/foundry/workshop/mobile-app-launcher/) and authenticate to Foundry. This requires your users to have a user account and to go through your organization's SSO authentication flow. We describe some considerations for these two steps below.

### Ensure users have accounts

Access to Foundry always requires a user account. Account-related considerations for users on mobile devices can be different than for desktop users. In our experience, some use cases targeting usage on mobile devices can involve a surprisingly complex device landscape:

* Some use cases require contractors to be able to access data from Foundry or submit data to Foundry. If your use case targets a broad set of users who are not employees of your organization, you should ensure these users have accounts and are able to [authenticate](/docs/foundry/authentication/overview/) to Foundry.
* Some mobile use cases target usage on shared devices. For example, there may be tablet devices used on a factory floor to access data in Foundry. The devices do not belong to a single user, but are instead shared between individuals in a work environment. In this case, you should confirm which users will be logging into each device. If necessary, it is possible to configure a dedicated user account per workstation, either in your identity provider or using Foundry's [internal realm](/docs/foundry/platform-security-management/manage-groups/#realms). If you need to enable an authentication pattern like this, contact your Palantir representative to learn more.

### Validate the end user authentication flow

Since the authentication process is a key part of the end-to-end user experience, you should validate what the end user authentication experience looks like on a mobile device. Users will need to go through your organization's SSO flow each time they need to authenticate, and will need to go through the MFA (multi-factor authentication) process.

Additionally, your organization's identity provider determines how often users need to re-authenticate to Foundry. If the login timeout is very frequent, this may add additional friction to the end user experience as users may need to authenticate frequently throughout the day. If this poses a problem for your users, contact your IT organization to discuss extending the session length in your identity provider.
